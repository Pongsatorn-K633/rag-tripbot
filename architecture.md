# Architecture — RAG TripBot

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
| LLM | Typhoon2-8B via Ollama | Thai-capable generation |
| VLM | TBD | PDF/screenshot → JSON extraction |
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
    ▼
Query pgvector with metadata filters
    │
    ▼
Retrieve matching blocks (core + extensions)
    │
    ▼
Prompt: System Wrapper + Retrieved Blocks + User Message
    │
    ▼
Typhoon2-8B generates assembled itinerary
    │
    ▼
Return structured JSON to frontend
```

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
Prompt: System Prompt + Full Itinerary JSON + User Message
    │
    ▼
Typhoon2-8B generates answer
    │
    ▼
Reply via LINE Messaging API
```

### System Prompt Strategy (LINE)

```
"You are an expert travel guide for this specific user/group. You must
only answer questions based on the following JSON itinerary. If they ask
about something not in this schedule, politely remind them of their plan.

[FULL ITINERARY JSON]"
```

---

## 6. Project Structure (Target)

```
rag-tripbot/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing / chat UI
│   ├── api/
│   │   ├── chat/route.ts       # Web RAG chat endpoint
│   │   ├── trips/route.ts      # Trip CRUD
│   │   ├── activate/route.ts   # Generate share code
│   │   └── line/webhook/route.ts  # LINE webhook handler
│   └── components/
├── lib/
│   ├── rag/                    # RAG pipeline logic
│   │   ├── retriever.ts        # pgvector query + metadata filtering
│   │   ├── embedder.ts         # BGE-M3 embedding calls
│   │   └── assembler.ts        # Block assembly logic
│   ├── llm/                    # Ollama / Typhoon2 client
│   ├── line/                   # LINE SDK helpers
│   └── db/                     # Prisma client
├── prisma/
│   ├── schema.prisma
│   └── seed/                   # Seed itinerary blocks into pgvector
├── services/
│   └── embedding/
│       ├── main.py             # FastAPI embedding microservice
│       └── requirements.txt    # Python deps (torch, sentence-transformers)
├── architecture.md             # ← This file
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

- [ ] Build embedding service (Python microservice or API route calling BGE-M3)
- [ ] Implement retrieval logic with metadata filtering
- [ ] Implement block assembly + LLM prompt pipeline
- [ ] Build chat UI (Next.js)
- [ ] Add itinerary confirmation + JSON finalization flow
- [ ] Generate activation codes on trip save

### Phase 3 — LINE Bot

- [ ] Set up LINE Messaging API channel + webhook
- [ ] Implement `/activate` command handler
- [ ] Implement context injection pipeline
- [ ] Handle both DM and group chat contexts

### Phase 4 — Upload & Templates

- [ ] Build template gallery UI
- [ ] Implement PDF/screenshot upload endpoint
- [ ] Integrate VLM for itinerary extraction
- [ ] Build verification UI for extracted JSON

---

## 8. Open Decisions

| Question | Options | Notes |
|---|---|---|
| Embedding service architecture | Python microservice vs. Next.js API calling Python | BGE-M3 requires PyTorch — may be too heavy for serverless |
| VLM choice | GPT-4V / Gemini / local model | Depends on budget and accuracy needs |
| Hosting | Vercel + Neon vs. self-hosted | Ollama needs GPU — likely a separate server |
| Auth (Web) | NextAuth / Clerk / none | Depends on whether user accounts are needed |
| LINE rich messages | Flex Messages vs. plain text | Better UX but more implementation effort |
