# RAG TripBot — Orchestrator Agent

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

## Subagent Roster

| File | Agent | Owns |
|---|---|---|
| `agents/db-agent.md` | DB Agent | Prisma schema, Neon connection, pgvector table, seed scripts |
| `agents/rag-agent.md` | RAG Agent | Embedder, retriever, block assembler, LLM prompt pipeline |
| `agents/web-agent.md` | Web Agent | Next.js UI, API routes (chat, trips, activate), itinerary flow |
| `agents/line-agent.md` | LINE Agent | Webhook handler, /activate command, context injection pipeline, LIFF itinerary view |

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
- [x] "Your Saved" section on `/templates` (above Curated Collections)

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
- [ ] Chat re-enable — deferred; `/chat → /maintenance` redirect still active

### Auth system quick reference

- **Providers:** Google OAuth (with `allowDangerousEmailAccountLinking: true`) + Resend magic link
- **Session:** JWT strategy, httpOnly cookie, encode-stripped to avoid HTTP 431
- **Roles:** `USER` / `ADMIN` / `SUPERADMIN` enum on `User.role`
- **Superadmin bootstrap:** email in `SUPERADMIN_EMAILS` env var → auto-promoted on first sign-in via `events.createUser` hook in `lib/auth.ts`
- **Middleware:** `middleware.ts` at project root uses `auth.config.ts` (edge-safe); API routes use `lib/auth.ts` + `requireSession/requireAdmin/requireSuperAdmin` from `lib/authz.ts`
- **Share code data flow:** `Template.shareCode` canonical; promoting a Trip reuses its shareCode; otherwise `generateShareCodeForTemplate()` creates a system-owned bridge Trip (see `lib/share-code.ts`)
- **Cover image pipeline:** `Template.coverImage` / `Trip.coverImage` stores IMG key or Cloudinary URL; `resolveCoverImage()` in `lib/cover-image.ts` normalizes; Cloudinary URLs get `c_fill,g_auto,ar_4:5,f_auto,q_auto` transformations injected at render time

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

When starting a session, tell Claude Code:
> "Read CLAUDE.md and the relevant agent file in agents/. You are acting as [agent name]."

To run a full build from scratch:
> "Read CLAUDE.md. Begin Phase 1 by acting as the DB Agent (agents/db-agent.md)."
