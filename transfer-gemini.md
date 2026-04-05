# Transfer Plan: Ollama + Tavily → Gemini

## What Changes

### Files to modify

| File | Current | After Gemini | What changes |
|------|---------|-------------|--------------|
| `lib/llm/client.ts` | Ollama (Typhoon2-8B local) | Gemini 2.0 Flash API | Rewrite: `generateFromOllama` → `generateText`, `generateFromVision` → `generateFromVision` (Gemini handles both) |
| `lib/rag/web-search.ts` | Tavily API | Gemini with Google Search grounding | Rewrite: `searchWeb` → use Gemini grounded search instead |
| `.env` | `OLLAMA_BASE_URL`, `TAVILY_API_KEY` | `GEMINI_API_KEY` | Remove Ollama + Tavily keys, add Gemini key |

### Files that stay the same (logic unchanged)

| File | Why unchanged |
|------|---------------|
| `lib/line/injector.ts` | Just imports from `lib/llm/client.ts` and `lib/rag/web-search.ts` — same function signatures |
| `lib/rag/assembler.ts` | Same — calls `generateFromOllama` and `searchWeb` |
| `lib/rag/extractor.ts` | Same — calls `generateFromOllama` |
| `lib/rag/retriever.ts` | Same — uses `embedText` (pgvector search, unrelated to LLM) |
| `lib/rag/embedder.ts` | Same — calls Python BGE-M3 service (embedding, not LLM) |
| `app/api/chat/route.ts` | Same — calls extractor + assembler |
| `app/api/line/webhook/route.ts` | Same — calls injector |
| `app/api/upload/route.ts` | Same — calls `generateFromVision` (Gemini supports vision natively) |
| `services/embedding/main.py` | Same — BGE-M3 embedding is separate from LLM |
| All frontend files | Same — no LLM logic in frontend |
| Prisma schema / DB | Same — no changes |

### Services to remove

| Service | Reason |
|---------|--------|
| Ollama (local) | Replaced by Gemini API |
| Tavily API | Replaced by Gemini Google Search grounding |

### Services that stay (paused)

| Service | Status | Reason |
|---------|--------|--------|
| Python embedding service (BGE-M3) | Paused — not called | Only 4 blocks in DB, not worth the overhead yet |
| Neon PostgreSQL + pgvector | Kept — schema stays | DB and table remain for future use |

These are **not removed**, just skipped. When the `itinerary_blocks` database grows with proprietary Thai travel content (curated tips, secret spots, negotiation advice, etc.), pgvector search gets turned back on to provide content Gemini can't find on the public web.

---

## Summary

Only **3 files** need rewriting + env vars. Everything else stays the same.

| File | Change |
|------|--------|
| `lib/llm/client.ts` | Ollama → Gemini API |
| `lib/rag/web-search.ts` | Tavily → Gemini with Google Search grounding |
| `lib/line/injector.ts` | Skip `searchBlocks()` in `fetchExtraContext` (pgvector paused) |
| `.env` | Remove `OLLAMA_BASE_URL`, `TAVILY_API_KEY` → add `GEMINI_API_KEY` |

```
Before:
  User question → injector → Ollama (Typhoon2-8B) → answer
                           → Tavily + pgvector → extra context → Ollama → answer

After (now):
  User question → injector → Gemini Flash → answer
                           → Gemini Flash (Google Search grounding) → answer

After (future, more blocks):
  User question → injector → Gemini Flash → answer
                           → Gemini Flash (Google Search grounding) + pgvector → answer
```
