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

### Phase 4 — Upload & Templates (Web Agent leads)
Delegate to `web-agent`. RAG Agent may assist if VLM output needs embedding.
- [ ] Template gallery page
- [ ] PDF/screenshot upload endpoint
- [ ] VLM integration for JSON extraction
- [ ] User verification UI for extracted JSON

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
