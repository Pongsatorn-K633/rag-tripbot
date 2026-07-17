# RAG TripBot — Orchestrator Agent

> **🚀 NEW SESSION / NEW ACCOUNT — READ FIRST:** [`docs/V3-HANDOFF.md`](docs/V3-HANDOFF.md) (auto-loaded
> below) is the full current state — the V3 itinerary schema, every pipeline + key file, the dev/prod
> workflow, settled decisions, the remaining roadmap, and the security review. The plan-JSON schema SSOT
> is [`docs/pre-planned-trip/columns.md`](docs/pre-planned-trip/columns.md).

@docs/V3-HANDOFF.md

You are the **master orchestrator** for the RAG TripBot project. Your job is to coordinate
all subagents, enforce phase sequencing, and maintain architectural consistency across the
entire codebase. You do NOT write implementation code directly — you delegate to specialists.

---

## Project Summary

A two-chatbot system for Japan trip planning targeting Thai travelers.
- **Web App** (Next.js): Planning phase — Hybrid Modular RAG chatbot
- **LINE Bot**: Execution phase — Context injection chatbot on the go

Target stack: Next.js · Prisma · Neon (PostgreSQL + pgvector) · BGE-M3 · Gemini 2.5 Flash · LINE Messaging API

**Production domain:** `dopamichi.com` (deployed on Vercel). All LINE webhook + LIFF URLs point at this domain. See `docs/deployment.md` for the full deploy + smoke-test checklist.

---

## Current Route Map (post-2026-07 UI pass)

The July 2026 homepage/navbar redesign renamed several **user-facing** routes. **Backend/API
names are unchanged** — still the `Template` model, `/api/templates`, `/api/upload`, the
`DocToTripForm`/`PlanCard` components, and `lib/trips/plan-json.ts` (the word "plan" as a
*concept*, not a route). Old routes permanent-redirect per `next.config.ts` where noted.

| Route | Purpose | Former name(s) |
|---|---|---|
| `/` | Photo hero landing | — |
| `/discover` | Curated pre-planned trip gallery | `/templates` → `/pre-planned` → `/plan` (all redirect; only `/pre-planned` kept) |
| `/my-trip` | The user's saved / activated trips + ✏️ edit | `/go` |
| `/create` | Hub → fans out to AI Chat + AI Scanner | (new) |
| `/ai-scanner` | Upload PDF/image → VLM → editable V3 trip | `/doc-to-trip` (was `/gallery`) |
| `/chat` | RAG chat — **under maintenance**, redirects to `/maintenance` | — |
| `/liff/pre-planned` | LINE LIFF twin — **do NOT rename** (tied to LINE console + `LIFF_PREPLANNED_URL`) | — |

Navbar tabs are **Discover · My Trip · Create** — Home was dropped; the logo + "dopamichi"
wordmark link home.

## UI / Design Conventions (alignment anchor for new UI/motion)

Quick-ref for generating or aligning any UI (e.g. Kimi-authored motion). Token values live in
`app/globals.css` `@theme`. **Full detail — hero z-layer anatomy, the bottom-fade seam, per-feature
motion recipes (parallax, navbar), and a pre-integration review checklist — is the SSOT at
[`docs/ui-alignment.md`](docs/ui-alignment.md).** Feed that file (+ `globals.css` + `Navbar.tsx` +
`page.tsx`) to any external UI tool.

- **Palette — cool, single scheme, NO dark mode.** Use Tailwind tokens, never raw hex:
  - `zen-black` `#122C4F` (Midnight — dark base + body text)
  - `briefing-cream` `#F7F9FC` (Cloud — light bg + text-on-dark)
  - `basel-brick` `#5B88B2` (Ocean — the **single** accent: buttons/links/hover/active). **No red anywhere.**
  - `noir` `#000000` (true black, deep-contrast moments)
  - `graphite` `#334155` (cool dark grey — text on light glass/milk surfaces)
  - `hinomaru` `#D80027` (Japan-flag red — **content only**, e.g. the flag badge; never a UI accent)
- **No theme switching.** Light is the only scheme. Do **not** add `dark:` variants or hardcoded
  `bg-white`. There is no theme provider — dark mode was removed entirely.
- **Fonts:** `font-headline` (Manrope) for display/UI, Inter for body, Noto Sans Thai for Thai.
  Thai headers scale `text-3xl md:text-5xl`.
- **Motion:** `motion/react` (Framer Motion) for entrance; CSS transitions for scroll/hover.
  Prefer real layout props (`width`/`height`, `grid-template-columns`) over `scale` transforms —
  scaling pixelates bitmaps and distorts border-radii.
- **Responsive sizing:** fluid `clamp(min, vw, max)` for hero type/padding; a `sizes` prop on
  every `next/image`.
- **Signature motion** (navbar bloom pills, hero seam, parallax): see the recipes in
  [`docs/ui-alignment.md`](docs/ui-alignment.md) — reuse that vocabulary, don't reinvent it.
- **Links in prose/docs:** always markdown `[file](path)` (IDE-clickable), not backticks.

---

## Subagent Roster

These are real Claude Code subagents (`.claude/agents/*.md`, with frontmatter) — invoke
them with the Task/Agent tool (e.g. *"use the db-agent subagent to add a column"*), not by
role-playing. Each file's body is the subagent's system prompt.

| File | Agent | Owns |
|---|---|---|
| `.claude/agents/db-agent.md` | DB Agent | Prisma schema, Neon connection, pgvector table, seed scripts |
| `.claude/agents/rag-agent.md` | RAG Agent | Embedder, retriever, block assembler, LLM prompt pipeline |
| `.claude/agents/web-agent.md` | Web Agent | Next.js UI, API routes (chat, trips, activate), itinerary flow |
| `.claude/agents/line-agent.md` | LINE Agent | Webhook handler, /activate command, context injection pipeline, LIFF itinerary view |
| `.claude/agents/auth-admin-agent.md` | Auth/Admin Agent | NextAuth, RBAC, middleware guards, admin dashboard, user management, share-code + cover/profile pipelines |
| `.claude/agents/security-agent.md` | Security Agent | Cross-cutting security audit + fixes (webhook, authz, upload, secrets, PII). Owns no directory — reads/audits all, writes fixes only |

---

## Implementation Phases — Delegation Map

Work through phases **in order**. Do not start a phase until the previous one is complete and verified.

### Phase 1 — Foundation (DB Agent leads) — COMPLETED 2026-04-04
Delegate entirely to `db-agent`. It must complete:
- [x] Next.js project initialized with TypeScript + ESLint + Tailwind
- [x] Prisma v7 + Neon connected and `.env` configured (driver adapter: `@prisma/adapter-pg`)
- [x] Relational schema migrated: `User`, `Trip`, `LineContext`
- [x] pgvector extension enabled + `itinerary_blocks` table created with HNSW index
- [x] 4 seed blocks inserted (1 core, 2 extensions, 1 day_trip) — Thai content

**Gate:** All migrations applied. Schema up to date. Seed data verified.

> ⚠️ **Maintenance notice (2026-04-08):** `/chat` is temporarily redirected to `/maintenance` via `next.config.ts`. The chat UI code at `app/chat/page.tsx` is preserved untouched and will be re-deployed soon. See `docs/architecture.md` for the re-enable checklist.

### Phase 2 — Web RAG Chatbot (RAG Agent + Web Agent in parallel)
- Delegate **backend pipeline** to `rag-agent`: embedder → retriever → assembler → LLM prompt
- Delegate **frontend + API routes** to `web-agent`: chat UI → `/api/chat` → trip save → activation code
- `web-agent` must import from `lib/rag/*` — it does NOT rewrite RAG logic
- `rag-agent` does NOT touch `app/` directory

**Gate:** End-to-end test — user query → retrieved blocks → assembled itinerary JSON returned.

### Phase 3 — LINE Bot (LINE Agent leads)
Delegate entirely to `line-agent`. It must complete:
- [x] LINE webhook route wired at `/api/line/webhook`
- [x] `/activate TKY-492` command stores lineId → tripId in `LineContext`
- [x] Context injection pipeline: lineId → Trip JSON → Gemini Flash → LINE reply
- [x] Group chat and DM both handled
- [x] LIFF integration — full plan view via Flex Message button instead of text dump
- [x] Hybrid intent classification — regex fast gate + LLM fallback for "show plan" detection

**Gate:** Activate command works; a question about the itinerary returns a correct answer. Full plan requests open a LIFF page via Flex Message.

### Phase 4 — Upload & Templates (Web Agent leads) — COMPLETED 2026-04-04
- [x] Template gallery page
- [x] PDF/screenshot upload endpoint
- [x] VLM integration for JSON extraction
- [x] User verification UI for extracted JSON

### Phase 5 — Auth + Admin System (Completed 2026-04-09)

Full NextAuth v5 + role-based access control rollout. See `docs/AUTH_TRANSFER_GUIDE.md`
for the full implementation guide and `eaaefbc` / `5b7d73e` for the final commits.

**Phase A — Foundation:**
- [x] Downgrade Prisma v7 → v6 for `@auth/prisma-adapter` compatibility
- [x] Install `next-auth@beta`, `@auth/prisma-adapter`, `resend`
- [x] Google OAuth + Resend credentials wired via `.env`
- [x] Expanded Prisma schema: `UserRole` enum, `Template`, `Account`, `Session`,
  `VerificationToken`, `Trip.coverImage`, `Trip.templateId`, `Template.shareCode`
- [x] `itinerary_blocks` declared as `Unsupported("vector(1024)")` so `db push`
  preserves the pgvector table

**Phase B — Auth wiring:**
- [x] Edge-safe split config: `auth.config.ts` (middleware) + `lib/auth.ts` (full)
- [x] JWT session strategy with encode-strip to avoid HTTP 431
- [x] Brand-matched auth pages (signin, verify-request, error) — bilingual
- [x] Middleware route guards: `/admin/*` requires ADMIN+, `/admin/users` SUPERADMIN
- [x] Navbar `NavUserMenu` — session-aware
- [x] Superadmin bootstrap via `events.createUser` + `SUPERADMIN_EMAILS` env

**Phase C — API gating:**
- [x] `POST/GET/DELETE /api/trips*` all read identity from session, not body
- [x] Owner check + admin override on deletes
- [x] `POST /api/upload` member-only to prevent VLM abuse
- [x] Gallery guest state + signin bounces + pending_itinerary preservation

**Phase D — Template system:**
- [x] Hardcoded templates migrated to `Template` table
- [x] `GET /api/templates` public, `POST/DELETE /api/templates/[id]/save` member-only
- [x] Heart icon save/unsave with optimistic updates + rollback
- [x] "Your Saved" section on the gallery (`/discover`, above Curated Collections)

**Phase E — Admin dashboard + cover system + share code unification:**
- [x] `/admin/dashboard` with Trips and Templates tabs
- [x] 5 admin API routes: trips list, templates CRUD, promote from trip
- [x] Cover image system: `Template.coverImage` stores IMG key or Cloudinary URL,
  resolved at render time with auto-injected `c_fill,g_auto,ar_4:5,f_auto,q_auto`
- [x] Custom branded `CoverUpload` component (replaces `CldUploadWidget` — no freeze)
- [x] Cloudinary library browser with Search API (supports both asset_folder and
  classic folder systems), delete-from-library + stale-cover cleanup sweep
- [x] Unified share codes: `Template.shareCode` canonical, same for everyone;
  promote reuses source trip's existing code; system-owned bridge Trip for
  LINE lookup when minted fresh
- [x] Trip lock system: trips promoted to published templates are locked from
  user deletion; red "Published" shield badge; admin override with cascade
  shareCode regeneration on next dashboard load

**Phase F — Superadmin user management:**
- [x] `/admin/users` with stats + user table
- [x] `/api/admin/users` list / `/api/admin/users/[id]` PATCH (role) / DELETE
- [x] Guardrails: cannot modify/delete self, cannot modify/delete SUPERADMINs,
  cannot delete system user
- [x] Cascade handling: delete user reassigns their created Templates to the
  system user, then cascade-deletes Trips/Sessions/Accounts/LineContexts
- [x] Two-step delete confirmation (GitHub/Vercel pattern — type email to confirm)

**Phase G — Hardening + Polish:**
- [x] Upstash rate limiting wired via `lib/rate-limit.ts` with graceful fallback
- [x] Magic link send rate-limited (5 per 10 min per email, blocks spam + enum)
- [x] `/api/upload` rate-limited (30 per min per user, blocks VLM abuse)
- [x] Branded HTML email template for magic links (bilingual, brand colors)
- [x] All `<img>` tags migrated to `next/image` `<Image />` with `remotePatterns`
  configured for `lh3.googleusercontent.com` + `res.cloudinary.com` in
  `next.config.ts` — automatic lazy loading, WebP/AVIF, responsive `sizes`.
  Logo uses `unoptimized` prop (Google `/aida/` path blocks the optimization
  proxy; `/aida-public/` stock images work fine without it)
- [x] Mobile hamburger navbar (all tabs + user menu in dropdown)
- [x] Saved templates collapsible accordion (closed by default, no viewport shift)
- [x] Responsive font sizing for Thai text headers on mobile (`text-3xl md:text-5xl`)
- [x] Template card images now full color (removed grayscale filter)
- [x] Gallery trip VIEW modal — click trip card → full itinerary accordion + share code
- [x] AI extraction rejects non-trip files (returns 422 with bilingual message instead of hallucinating a fake itinerary)
- [x] New user onboarding flow (`/onboarding`) — display name + profile picture upload with circular crop
- [x] Profile picture upload with `react-easy-crop` (drag to reposition + zoom) → cropped to 512×512 JPEG → Cloudinary `dopamichi/profiles` folder via separate upload preset
- [x] Settings page (`/settings`) — Account tab (edit profile). *(General/theme-toggle tab removed in the 2026-07 UI pass — single palette now.)*
- [x] ~~Dark mode infrastructure~~ — **REMOVED (2026-07).** Now a single cool palette: no `.dark` variant in `globals.css`, no theme toggle. `ThemeProvider` was **deleted** (`providers.tsx` now wraps only `SessionProvider`).
- [x] Navbar profile dropdown menu (desktop) + profile picture next to hamburger (mobile)
- [x] Logo migrated from expired Google Aida URL to local `/public/android-chrome-192x192.png`
- [ ] Chat re-enable — deferred; `/chat → /maintenance` redirect still active

### Auth system quick reference

- **Providers:** Google OAuth (with `allowDangerousEmailAccountLinking: true`) + Resend magic link
- **Session:** JWT strategy, httpOnly cookie, encode-stripped to avoid HTTP 431
- **Roles:** `USER` / `ADMIN` / `SUPERADMIN` enum on `User.role`
- **Superadmin bootstrap:** email in `SUPERADMIN_EMAILS` env var → auto-promoted on first sign-in via `events.createUser` hook in `lib/auth.ts`
- **Middleware:** `middleware.ts` at project root uses `auth.config.ts` (edge-safe); API routes use `lib/auth.ts` + `requireSession/requireAdmin/requireSuperAdmin` from `lib/authz.ts`
- **Share code data flow:** `Template.shareCode` canonical; promoting a Trip reuses its shareCode; otherwise `generateShareCodeForTemplate()` creates a system-owned bridge Trip (see `lib/share-code.ts`)
- **Cover image pipeline:** `Template.coverImage` / `Trip.coverImage` stores IMG key or Cloudinary URL; `resolveCoverImage()` in `lib/cover-image.ts` normalizes; Cloudinary URLs get `c_fill,g_auto,ar_4:5,f_auto,q_auto` transformations injected at render time
- **Profile picture pipeline:** `ProfilePictureUpload` component uses `react-easy-crop` for circular crop → canvas → 512×512 JPEG blob → uploaded to Cloudinary via separate `NEXT_PUBLIC_CLOUDINARY_PROFILE_PRESET` preset (folder: `dopamichi/profiles`)
- **Theme system:** ~~dark mode~~ **removed (2026-07)** — single cool palette (Midnight/Cloud/Ocean + Noir) in `globals.css` `@theme`. No `.dark` variant, no toggle, no `ThemeProvider` (deleted). Tokens are in the "UI / Design Conventions" section above.
- **Onboarding:** New magic-link users (`isOnboarded: false`) are redirected to `/onboarding` by middleware. Google OAuth users are auto-marked onboarded (they already have a name). Form: display name + profile picture upload. Completes via `PATCH /api/auth/onboarding` + `session.update()`

### Phase 6 — Testing + QA (PLANNED, not started)

> **Why this is a separate phase, not work for an existing agent:** the project currently has
> **no automated test suite** (`package.json` scripts are `dev / build / start / lint / db:*`
> only — no Vitest/Jest/Playwright). Until a suite exists there is nothing for a QA agent to
> own, so day-to-day quality is handled by the built-in skills:
> - `/code-review` — correctness + reuse/simplification/efficiency pass
> - `/security-review` + `agents/security-agent.md` — security threat model
> - `/verify` and `/run` — confirm a feature works in the real app
> - the orchestrator (this file) — architectural contract + boundary enforcement

When testing is introduced, this phase adds:
- [ ] Unit tests for `lib/` (Vitest) — RAG assembler/retriever, share-code, authz, cover-image, injector
- [ ] E2E tests (Playwright) — auth/onboarding flow, trips save + activate, LINE webhook (signed payloads), admin guardrails
- [ ] CI gate (GitHub Actions) — run `lint` + tests on PR
- [ ] **Then** create a **Test/QA Agent** (`agents/qa-agent.md`) to own `tests/`, coverage, the CI gate, and the "definition of done" — and add it to the Subagent Roster.

> **Decision (2026-05-29):** No standalone QA agent today — it would duplicate `/code-review`.
> Revisit and scaffold the Test/QA Agent the moment a test framework lands (the trigger that
> flips this decision).

### Phase 7 — Duplicate & Edit (web + LIFF, aligned) — IN PROGRESS

User-facing feature: duplicate a pre-planned trip into a personal editable copy (+ activation
code) and make light edits (pick choices, set start date, reorder/remove activities, add notes),
on **both** the website and the LINE LIFF — from one shared core. Full spec + resumable steps in
**`docs/duplicate-edit-feature.md`**.

- [x] **Phase A** — shared edit core (`lib/trips/edit.ts`) + `GET`/`PATCH /api/trips/[id]`
- [x] **Phase B** — shared `app/components/ItineraryEditor.tsx` + `app/trips/[id]/edit` + `/my-trip` ✏️ button + `Choice.selected`
- [ ] **Phase C** — LIFF identity (`User.lineUserId`, `@line/liff`, `lib/line/liff-auth.ts`),
  `lib/trips/duplicate.ts`, `/api/liff/duplicate` + `/api/liff/trip`, `/liff/edit` reusing the editor
- [ ] **Phase D** — hardening (rate-limit duplicate, "my LINE trips", security review)

> **Decision (2026-05-30):** Web duplicate+edit shipped first (browser-verifiable, no LINE
> identity needed). Phase C/D (LIFF) deferred — resume from `docs/duplicate-edit-feature.md`.

---

## Architectural Rules (Enforce These Always)

1. **Separation of concerns** — No agent writes code outside its owned directories (see each agent's `.md`).
2. **Shared Prisma client** — All agents import from `lib/db/index.ts`. No agent creates its own DB connection.
3. **Environment variables** — All secrets go in `.env`. No hardcoded keys anywhere. This includes `LIFF_ID` for the LINE Front-end Framework.
4. **Thai language support** — All LLM prompts must be tested with Thai input. Gemini 2.5 Flash is the required model.
5. **Itinerary JSON is the contract** — The shape of the itinerary JSON must be agreed on in Phase 1 and never changed without updating all agents.
6. **No pgvector logic in the web layer** — Retrieval lives in `lib/rag/retriever.ts` only.
7. **Update architecture.md after each phase** — When an agent completes its tasks, update the phase checklist in `architecture.md` with completion status and date. This keeps the architecture doc in sync with actual progress.

---

## Itinerary JSON Contract (Agreed Shape)

> **SSOT for the pre-planned trip plan JSON:** [`docs/pre-planned-trip/columns.md`](docs/pre-planned-trip/columns.md)
> — the authoritative field-by-field schema (Excel columns ↔ JSON keys) **and** the bilingual
> Thai/English style rules. When working with plan JSON (import, builder, Excel), read it first
> and treat it as canonical. If the schema changes, update that file **and** the code together.
> The V1 shape below is legacy (early seeds / doc-to-trip); the richer plan schema is V2→V3.

All agents must use this exact shape. Do not deviate.

```json
{
  "tripId": "cuid",
  "title": "Japan Winter 2026",
  "totalDays": 8,
  "season": "Winter",
  "days": [
    {
      "day": 1,
      "location": "Tokyo",
      "activities": [
        { "time": "09:00", "name": "Senso-ji Temple", "notes": "Arrive early" }
      ],
      "accommodation": "Hotel Gracery Shinjuku",
      "transport": "Narita Express from airport"
    }
  ],
  "shareCode": "TKY-492"
}
```

---

## How to Use This File in Claude Code

The roster agents are real subagents in `.claude/agents/`. Delegate to one with the
Task/Agent tool — Claude Code auto-selects by the subagent's `description`, or you can name it:
> "Use the **db-agent** subagent to add the `Trip.notes` column and migrate."

> "Use the **security-agent** subagent to audit the LINE webhook signature check."

The orchestrator (this file) stays the delegation map: it enforces phase sequencing and the
architectural rules below, and routes work to the right subagent rather than implementing
directly.
