# Architecture — RAG TripBot

> **Production:** [dopamichi.com](https://dopamichi.com) — deployed on Vercel.
> See `docs/deployment.md` for env vars, DNS, LINE webhook config, and the
> pre-deploy checklist.

## System Overview

Two-chatbot system for Japan trip planning, targeting Thai travelers.

| Environment | Interface | Strategy | Purpose |
|---|---|---|---|
| **General Chatbot** | Next.js Web App | Hybrid Modular RAG | Planning phase — brainstorm & assemble itineraries |
| **Tailored Chatbot** | LINE Messaging | Context Injection (no RAG) | Execution phase — answer trip-specific questions on the go |

---

## 1. Customer Journey

### Phase 1: Planning (Web)

```
User opens Web App
    │
    ├─ Option A: Chat with AI → Modular RAG assembles itinerary
    ├─ Option B: Select curated template
    └─ Option C: Upload PDF/Screenshot → VLM extracts to JSON → User verifies
    │
    ▼
User confirms itinerary
    │
    ▼
System saves finalized JSON + generates Activation Code (e.g., TKY-492)
```

### Phase 2: Execution (LINE)

```
User sends "/activate TKY-492" in LINE (DM or Group)
    │
    ▼
Backend links LINE userId/groupId → Trip ID
    │
    ▼
User asks questions → Bot injects itinerary JSON into prompt → Instant answer
```

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js (App Router) | Web chat UI, template gallery, upload flow |
| Backend API | Next.js API Routes | Chat endpoint, trip CRUD, activation |
| ORM | Prisma | Schema management, Neon queries |
| Database | Neon (PostgreSQL) | Relational data (trips, LINE contexts) |
| Vector DB | pgvector (on Neon) | Itinerary block embeddings |
| Embedding | BAAI/bge-m3 (1024-dim) | Text → vector via sentence-transformers |
| LLM | Gemini 2.5 Flash | Thai-capable generation (text + vision) |
| Web Search | Gemini with Google Search grounding | Real-time web search to enhance RAG with latest info |
| LINE Integration | LINE Messaging API + Webhook | Tailored chatbot delivery |

---

## 3. Database Schema

### Relational (Prisma / Neon)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String?  @unique
  trips     Trip[]
  createdAt DateTime @default(now())
}

model Trip {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  title       String        // e.g., "Japan Winter 2026"
  itinerary   Json          // Finalized schedule
  shareCode   String?       @unique // e.g., "TKY-492"
  createdAt   DateTime      @default(now())
  activeChats LineContext[]
}

model LineContext {
  id         String   @id @default(cuid())
  lineId     String   @unique // LINE User ID or Group ID
  sourceType String   // "user" or "group"
  tripId     String
  trip       Trip     @relation(fields: [tripId], references: [id])
  updatedAt  DateTime @updatedAt
}
```

### Vector (pgvector)

```sql
CREATE TABLE itinerary_blocks (
    id          SERIAL PRIMARY KEY,
    content     TEXT,
    embedding   vector(1024),
    type        VARCHAR(20),       -- "core", "extension", "day_trip"
    duration    INT,               -- number of days
    start_loc   VARCHAR(100),
    end_loc     VARCHAR(100),
    season      TEXT[]             -- e.g., {"Winter", "December"}
);
```

### Retrieval Logic

User requests N-day trip → Application queries:

1. Find `core` block where `duration` is closest to N
2. If `core.duration < N`, find `extension` blocks where durations sum to remainder
3. Filter by `season` and geographic connectivity (`end_loc` → `start_loc`)
4. Feed matched blocks to LLM to assemble into single itinerary JSON

---

## 4. RAG Pipeline (Web App)

```
User Query
    │
    ▼
Extract Parameters (month, duration, vibe)
    │
    ├──────────────────────────┐
    ▼                          ▼
Query pgvector             Gemini Google Search grounding
(metadata filters)         (real-time info)
    │                          │
    ▼                          ▼
Retrieve blocks            Web results
(core + extensions)        (sakura dates, events, closures)
    │                          │
    └──────────┬───────────────┘
               ▼
Prompt: Blocks + Web Results + User Message
               │
               ▼
Gemini 2.5 Flash assembles itinerary
               │
               ▼
Return structured JSON to frontend
```

Both sources run **in parallel**. pgvector provides the base itinerary structure; Gemini with Google Search grounding enriches it with real-time info (seasonal forecasts, trending spots, closures, prices). If `GEMINI_API_KEY` is not set, web search is silently skipped.

### System Prompt Strategy (Web)

```
"The user is planning a trip to Japan. Extract their desired travel period
and duration.
- If they provide exact dates (e.g., Dec 5-12), proceed.
- If they provide a vague timeframe (e.g., late December for 8 days), proceed.
- If they exceed 15 days, remind them that Thai citizens require a visa
  for stays over 15 days.
Output the required search parameters (Month, Duration, Vibe) to query
the VectorDB."
```

---

## 5. Context Injection Pipeline (LINE Bot)

```
LINE Message received via Webhook
    │
    ▼
Extract lineId (userId or groupId)
    │
    ▼
Lookup LineContext → Trip → itinerary JSON
    │
    ▼
Hybrid intent classification (isFullPlanRequest)
    │
    ├── Regex fast gate match ("ขอดูแผน", "plan please"…) ──┐
    │                                                         │
    └── No regex match → Gemini call (Step 1 classify +       │
        Step 2 answer in one prompt)                          │
         │                                                    │
         ├── Returns [SHOW_PLAN] token ──────────────────────┤
         │                                                    ▼
         │                                          LIFF view path:
         │                                          Reply Flex Message
         │                                          with "ดูแผนเต็ม"
         │                                          button → opens
         │                                          app/liff/itinerary
         │                                          (dark-themed UI,
         │                                          fetches trip via
         │                                          /api/trips/by-code)
         │
         ▼
Fast path: answer from itinerary only (same Gemini call Step 2)
    │
    ├── Answer sufficient → Reply via LINE
    │
    └── Answer insufficient (fallback phrases detected)
        │
        ▼
    Enriched path: generateWithSearch() — single Gemini 2.5 Flash
    call with Google Search grounding + persona prompt built in
        │
        ▼
    Reply via LINE Messaging API
```

### Hybrid Intent Classification

`isFullPlanRequest()` uses a two-layer approach to detect "show full plan" requests:

1. **Regex fast gate** — catches clean requests like "ขอดูแผน", "plan please", "itinerary" with 0 API calls.
2. **LLM fallback** — if regex does not match, the Gemini prompt includes intent classification as Step 1. If Gemini detects a "show plan" intent (even with typos like "plna pls"), it returns `[SHOW_PLAN]` token. Otherwise it proceeds to answer the question normally in Step 2. This is done in the **same Gemini call** — no extra API cost.

Prompt structure:
- **Step 1: จำแนกความต้องการ** — classify if user wants to VIEW the full plan → `[SHOW_PLAN]`
- **Step 2: ตอบคำถาม** — answer the question from itinerary

Note: "สรุปทริป" (trip summary) goes to Step 2 (Gemini answers), NOT treated as a full plan view request.

### LIFF Integration

Instead of dumping the full itinerary as text in LINE chat, the bot sends a Flex Message with a button that opens a LIFF (LINE Front-end Framework) page showing the itinerary in a beautiful dark-themed UI.

- **LIFF ID** stored in `.env` as `LIFF_ID`
- **LIFF page** `app/liff/itinerary/page.tsx` — fetches trip by shareCode via `/api/trips/by-code?shareCode=XXX`, renders day-by-day accordion with dark theme
- **API endpoint** `GET /api/trips/by-code?shareCode=XXX` — returns trip itinerary JSON
- **LINE client** `lib/line/client.ts` — `replyFlexMessage()` helper for Flex Messages
- **Injector** `lib/line/injector.ts` — `answerWithContext()` returns `liffView` object when a full plan is requested
- **Webhook** `app/api/line/webhook/route.ts` — handles `liffView` result by sending a Flex Message with "ดูแผนเต็ม" button

### System Prompt Strategy (LINE)

**Fast path:** The bot first tries to answer from the itinerary JSON alone using `generateText()`. The prompt includes Step 1 intent classification — if the user wants to view the plan, Gemini emits `[SHOW_PLAN]` and the handler switches to the LIFF flow.

**Enriched path:** If the fast answer contains fallback phrases (e.g., "ไม่มีข้อมูลในแผน"), the bot calls `generateWithSearch()` from `lib/rag/web-search.ts` — a single Gemini 2.5 Flash call with Google Search grounding and the persona prompt built in. No separate web search step is needed; Gemini searches Google directly as part of generation.

```
Fast path prompt:
"You are an expert travel guide.
Step 1: จำแนกความต้องการ — if user wants to VIEW the full plan, reply [SHOW_PLAN].
Step 2: ตอบคำถาม — otherwise, answer from the itinerary JSON only.
[FULL ITINERARY JSON]"

Enriched path prompt (sent to generateWithSearch):
"You are an expert travel guide. This question is not in the itinerary.
Search Google and answer from web results.
[ITINERARY JSON for reference]"
```

---

## 6. Project Structure (Target)

```
rag-tripbot/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing / chat UI
│   ├── liff/
│   │   └── itinerary/page.tsx  # LIFF page — dark-themed day-by-day accordion
│   ├── api/
│   │   ├── chat/route.ts       # Web RAG chat endpoint
│   │   ├── trips/route.ts      # Trip CRUD
│   │   ├── trips/by-code/route.ts  # GET shareCode -> trip JSON (for LIFF)
│   │   ├── activate/route.ts   # Generate share code
│   │   └── line/webhook/route.ts  # LINE webhook handler
│   └── components/
├── lib/
│   ├── rag/                    # RAG pipeline logic
│   │   ├── retriever.ts        # pgvector query + metadata filtering
│   │   ├── embedder.ts         # BGE-M3 embedding calls
│   │   └── assembler.ts        # Block assembly logic
│   ├── llm/                    # Gemini 2.5 Flash client (generateText, generateFromVision)
│   ├── line/                   # LINE SDK helpers
│   └── db/                     # Prisma client
├── prisma/
│   ├── schema.prisma
│   └── seed/                   # Seed itinerary blocks into pgvector
├── services/
│   └── embedding/
│       └── main.py             # FastAPI embedding microservice
├── docs/architecture.md        # ← This file
├── .env
├── package.json
└── requirements.txt            # Python deps (embedding service)
```

---

## 7. Implementation Phases

### Phase 1 — Foundation (Completed 2026-04-04)

- [x] Initialize Next.js project with TypeScript + ESLint + Tailwind (App Router, no src dir)
- [x] Set up Prisma v7 + Neon database (using `@prisma/adapter-pg` driver adapter)
- [x] Create relational schema (User, Trip, LineContext) — migration applied
- [x] Set up pgvector extension + `itinerary_blocks` table with HNSW index
- [x] Seed 4 itinerary blocks (1 core, 2 extensions, 1 day_trip) — Thai content, embeddings NULL for RAG Agent

### Phase 2 — Web RAG Chatbot

**Backend (RAG Agent — Completed 2026-04-04)**
- [x] Build embedding microservice (`services/embedding/main.py` — FastAPI + BGE-M3 on port 8001)
- [x] Implement TypeScript embedder client (`lib/rag/embedder.ts`)
- [x] Implement retrieval logic with pgvector + metadata filtering (`lib/rag/retriever.ts`)
- [x] Implement block assembly + LLM prompt pipeline (`lib/rag/assembler.ts`)
- [x] Implement parameter extraction from user messages (`lib/rag/extractor.ts`)
- [x] Implement Gemini 2.5 Flash LLM client (`lib/llm/client.ts`)

**Frontend (Web Agent — Completed 2026-04-04)**
- [x] Build chat UI — `ChatWindow`, `MessageBubble`, `ItineraryCard`, `ActivationBanner` components
- [x] Wire `/api/chat` route to RAG pipeline (`extractTripParams` → `assembleItinerary`)
- [x] Wire `/api/trips` route for trip CRUD (save + fetch)
- [x] Add itinerary confirmation + JSON finalization flow
- [x] Generate activation codes on trip save (`/api/activate`)

### Phase 3 — LINE Bot (Completed 2026-04-04)

- [x] Set up LINE Messaging API webhook at `/api/line/webhook` with HMAC-SHA256 signature validation
- [x] Implement `/activate` command handler — upserts `LineContext` to link lineId → tripId
- [x] Implement context injection pipeline (`lib/line/injector.ts`) — fast path (itinerary-only via `generateText`) + enriched path (single `generateWithSearch` call with Google Search grounding)
- [x] Handle both DM (user source) and group chat (group source) via `lib/line/parser.ts`
- [x] LINE SDK client wrapper (`lib/line/client.ts`) — `replyToLine`, `pushToLine`, `replyFlexMessage`
- [x] LIFF integration — `app/liff/itinerary/page.tsx` dark-themed itinerary view + `GET /api/trips/by-code` endpoint; full plan requests return a Flex Message with "ดูแผนเต็ม" button instead of dumping text
- [x] Hybrid intent classification (regex fast gate + LLM `[SHOW_PLAN]` fallback in the same Gemini call)
- [x] **Group-chat trigger word gate (2026-04-08)** — in group sources, the bot only replies when the message starts with `doma`, `โดมะ`, `@dopamichi` (or the bot is @-mentioned via `mention.mentionees`). Without a trigger, the bot silently ignores the message so regular group conversation is never interrupted. `/activate` always works. Implemented in `lib/line/trigger.ts` + `lib/line/parser.ts`. Requires `LINE_BOT_USER_ID` env var for real @-mention detection (text-based triggers still work without it). `@all` is intentionally **not** a trigger.
- [x] **Group welcome message (2026-04-08)** — webhook handles the LINE `join` event and sends a bilingual greeting explaining the trigger-word rule whenever the bot is added to a new group.

### Phase 4 — Upload & Templates (Completed 2026-04-04)

- [x] Build template gallery page (`app/templates/page.tsx`) — 4 curated templates with modal preview + save flow
- [x] Build reusable `TemplateCard` component (`app/components/TemplateCard.tsx`)
- [x] Implement PDF/screenshot upload endpoint (`app/api/upload/route.ts`) — LLM-based text extraction
- [x] Build upload page with drag-and-drop UI (`app/upload/page.tsx`)
- [x] Build verification UI — reuses `ItineraryCard` for user review before saving
- [x] VLM integration — Gemini 2.5 Flash for image OCR and PDF text extraction

### Phase 5 — Auth + Admin + Hardening (Completed 2026-04-09)

Full NextAuth v5 + role-based access control rollout. See `docs/AUTH_TRANSFER_GUIDE.md`
for the step-by-step implementation guide.

**Phase A — Foundation:** Prisma v7 → v6 downgrade (for `@auth/prisma-adapter`
compatibility), expanded schema with `UserRole` enum, `Template`, `Account`,
`Session`, `VerificationToken`, `Trip.coverImage`, `Trip.templateId`,
`Template.shareCode`. `itinerary_blocks` declared as `Unsupported("vector(1024)")`
so `db push` preserves the pgvector table.

**Phase B — Auth wiring:** Edge-safe split config (`auth.config.ts` for
middleware + `lib/auth.ts` for full Node). JWT session strategy with encode
stripping to avoid HTTP 431. Brand-matched bilingual auth pages. Middleware
guards `/admin/*` (ADMIN+) and `/admin/users` (SUPERADMIN). Superadmin
bootstrap via `SUPERADMIN_EMAILS` env + `events.createUser` hook.

**Phase C — API gating:** All `/api/trips*`, `/api/activate`, `/api/upload`
read identity from session instead of request body. Owner + admin override
checks on deletes. Gallery guest state with sign-up CTA.

**Phase D — Template system migration:** Hardcoded templates moved to DB,
`POST/DELETE /api/templates/[id]/save` endpoints, heart icon with optimistic
updates + rollback, "Your Saved" section on `/templates`.

**Phase E — Admin dashboard + cover system + share codes:**
- `/admin/dashboard` with Trips and Templates tabs, promote-from-trip flow
- Cover images stored as IMG keys or Cloudinary URLs, resolved via
  `lib/cover-image.ts` with auto-injected `c_fill,g_auto,ar_4:5,f_auto,q_auto`
  transformations. Custom branded `CoverUpload` component (no widget freeze).
  Admin Cloudinary library browser (Search API, supports both dynamic
  `asset_folder` and classic `folder` systems). Delete-from-library + stale
  cover cleanup sweep.
- Share codes unified: `Template.shareCode` canonical (same for all users);
  promote reuses source trip's code; `generateShareCodeForTemplate()` creates
  a hidden system-owned bridge Trip for LINE lookup when minting fresh.
- Trip lock: promoted trips are locked from user deletion (red "Published"
  shield badge). Admin override nulls the template's shareCode, which gets
  auto-backfilled on the next dashboard load.

**Phase F — Superadmin user management:** `/admin/users` with role
promote/demote + delete. Cannot modify/delete self or SUPERADMINs. Templates
created by a deleted user get reassigned to the system user before cascade.
Two-step typed-email delete confirmation.

**Phase G — Hardening:** Upstash rate limiting via `lib/rate-limit.ts` with
graceful fallback when env vars are missing:
- `authRateLimit` — 5 magic-link requests per 10 min per email
- `apiRateLimit` — 30 requests per min per user on `/api/upload`
Branded HTML email template for magic links (bilingual, brand colors). Custom
`sendVerificationRequest` in `lib/auth.ts` uses Resend SDK directly.

### Auth system quick reference

| Component | Location |
|---|---|
| Edge-safe auth config | `auth.config.ts` (providers + minimal callbacks) |
| Full auth config | `lib/auth.ts` (adapter + jwt encode strip + Resend + createUser hook) |
| Middleware route guards | `middleware.ts` (uses edge config) |
| Authz helpers | `lib/authz.ts` — `requireSession`, `requireAdmin`, `requireSuperAdmin` |
| Rate limiting | `lib/rate-limit.ts` — `authRateLimit`, `apiRateLimit`, `checkLimit` |
| Share code generation | `lib/share-code.ts` — `generateShareCodeForTemplate`, `getSystemUserId` |
| Cover image resolver | `lib/cover-image.ts` — `resolveCoverImage` with Cloudinary transform injection |
| Cloudinary direct upload | `lib/cloudinary-upload.ts` + `app/components/CoverUpload.tsx` |
| Trip lock detection | `lib/trip-lock.ts` — `getTripLockInfo`, `getLockedTripIds` |
| Auth pages | `app/auth/signin` · `verify-request` · `error` |
| Admin pages | `app/admin/dashboard` · `app/admin/users` |

---

## ⚠️ Maintenance Notice (2026-04-08)

The **AI Chat (`/chat`)** route is currently in **maintenance mode**:

- `/chat` is redirected to `/maintenance` via `next.config.ts` (temporary redirect)
- The original chat UI at `app/chat/page.tsx` is **preserved intact** and will be redeployed in the near future
- The "AI Chat" tab in the Navbar is disabled with a "Soon" badge
- The home page pathway card for chat is greyed out and routes to `/maintenance`
- A playful bilingual (Thai + English) maintenance screen lives at `app/maintenance/page.tsx`

**To re-enable:** delete the `/chat` entry in `next.config.ts` `redirects()`, remove `disabled: true` from the chat tab in `app/components/Navbar.tsx`, and restore the original pathway card in `app/page.tsx`.

---

## 8. UI Rendering Strategy

The app uses three rendering modes depending on the page's data needs.
All images use `next/image` `<Image />` with `remotePatterns` configured
for `lh3.googleusercontent.com` and `res.cloudinary.com` (see
`next.config.ts`), giving automatic lazy loading + WebP/AVIF conversion.

**Logo exception:** The dopamichi logo URL (`lh3.googleusercontent.com/aida/...`)
uses a private Google path that blocks Next.js's image optimization proxy. All
`IMG.logo` usages have `unoptimized` prop set, which loads the URL directly in
the browser (same as `<img>`). This only affects the ~32px logo — all large
cover/hero images (`/aida-public/...` path) go through the optimization proxy
normally.

### SSG — Static Site Generation (`○` in build output)

Pre-rendered at build time, served from Vercel CDN. Zero server compute.
Used for pages with no per-user data in the initial HTML.

| Route | Notes |
|---|---|
| `/` | Home page — pure static |
| `/templates` | Shell is static; template list + saved state load client-side via `useEffect` |
| `/gallery` | Shell is static; trips + upload state are client-side |
| `/chat` | Shell is static; chat messages are client-side state (currently behind `/maintenance` redirect) |
| `/auth/signin`, `verify-request`, `error` | Static forms; `signIn()` runs client-side |
| `/maintenance`, `/privacy`, `/terms`, `/about`, `/support` | Pure static, no data |
| `/liff/itinerary` | Static shell; fetches trip by shareCode client-side |

### SSR — Server-Side Rendering (`ƒ` in build output)

HTML generated per request. Used when the server must check auth/role
before deciding what to render (e.g. `await auth()` + `redirect()`).

| Route | Notes |
|---|---|
| `/admin/dashboard` | Server component calls `auth()` + `isAdminRole()`, then renders `<AdminDashboard>` client component |
| `/admin/users` | Server component calls `auth()` + `isSuperAdmin()`, then renders `<UsersAdmin>` client component |

### CSR — Client-Side Rendering (inside `'use client'` components)

After the SSG/SSR shell loads, JavaScript in the browser fetches data
and updates the DOM. All interactive features use this pattern:
`useSession()`, `fetch('/api/...')`, `useState`, `AnimatePresence`, etc.

### Serverless Functions (API routes)

Every `/api/*` route is an independent Node.js function. Runs on-demand
(cold-start ~200ms on Vercel hobby tier). Auth is checked per-route via
`await auth()` from `lib/auth.ts`.

### Edge Runtime (middleware)

`middleware.ts` runs on Vercel's edge network before every page request.
Uses the edge-safe `auth.config.ts` (no Prisma/pg imports) to decode
the JWT session cookie and enforce route guards (`/admin/*` requires
ADMIN+, `/admin/users` requires SUPERADMIN).

### What we do NOT use

| Technique | Why not |
|---|---|
| ISR (Incremental Static Regeneration) | Templates change rarely; CSR fetch on mount is simpler and always fresh |
| Streaming RSC | Admin pages use RSC but redirect or render a client wrapper — no streaming benefit |
| PPR (Partial Pre-Rendering) | Not stable in Next 15.5; SSG + CSR achieves a similar result |

---

## 9. Open Decisions

| Question | Options | Notes |
|---|---|---|
| ~~Embedding service architecture~~ | ~~Python microservice vs. Next.js API calling Python~~ | **Decided:** Python FastAPI microservice at `services/embedding/` |
| ~~VLM choice~~ | ~~GPT-4V / Gemini / local model~~ | **Decided:** Gemini 2.5 Flash — handles both text + vision natively |
| Hosting | Vercel + Neon vs. self-hosted | Gemini is cloud API — no GPU server needed |
| Auth (Web) | NextAuth / Clerk / none | Depends on whether user accounts are needed |
| ~~LINE rich messages~~ | ~~Flex Messages vs. plain text~~ | **Decided:** Flex Message with LIFF button for full plan view; plain text for Q&A |
