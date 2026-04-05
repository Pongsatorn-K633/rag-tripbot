# RAG TripBot

A two-chatbot system for Japan trip planning, targeting Thai travelers.

- **Web App** (Next.js) — Planning phase: a Hybrid Modular RAG chatbot that assembles day-by-day itineraries from pre-built blocks stored in pgvector.
- **LINE Bot** — Execution phase: a context injection chatbot that answers trip-specific questions on the go using the finalized itinerary.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Backend API | Next.js API Routes |
| ORM | Prisma v7 (`@prisma/adapter-pg`) |
| Database | Neon (PostgreSQL + pgvector) |
| Embedding | BAAI/bge-m3 (1024-dim) via FastAPI microservice |
| LLM | Typhoon2-8B via Ollama (Thai-capable) |
| VLM | Qwen2.5-VL 7B via Ollama (image OCR) |
| Web Search | Tavily API (real-time RAG) |
| LINE | LINE Messaging API + Webhook |

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **Ollama** installed and running
- **Neon** database (or any PostgreSQL with pgvector)

## Setup

### 1. Install dependencies

This project uses **two runtimes** — Node.js for the web app and Python for the embedding microservice. Install both:

```bash
npm install                       # Node.js (Next.js, Prisma, LINE SDK, etc.)
pip install -r requirements.txt   # Python (FastAPI, sentence-transformers, torch, etc.)
```

### 2. Configure environment variables

Copy `.env.example` or create `.env` with:

```env
DATABASE_URL="postgresql://..."       # Neon pooled connection
DIRECT_URL="postgresql://..."         # Neon direct connection (for migrations)
EMBEDDING_SERVICE_URL=http://localhost:8001
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=qwen2.5vl:7b                    # VLM for image upload OCR
TAVILY_API_KEY=tvly-xxxxx                            # Optional — enables real-time web search in RAG
LINE_CHANNEL_SECRET=your_channel_secret             # From LINE Developers Console
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token  # From LINE Developers Console
```

### 3. Run database migrations and seed

```bash
npx prisma migrate dev          # Apply relational schema
npm run db:setup-pgvector       # Create itinerary_blocks table + HNSW index
npm run db:seed                 # Seed sample itinerary blocks
```

### 4. Start the embedding service

```bash
python services/embedding/main.py
```

This starts the BGE-M3 embedding microservice on port 8001. Keep it running in a separate terminal.

### 5. Pull the LLM and VLM models

```bash
ollama pull scb10x/llama3.1-typhoon2-8b-instruct    # Text LLM (Thai-capable)
ollama pull qwen2.5vl:7b                             # Vision model (image OCR)
```

Ollama serves the model on port 11434 by default.

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
rag-tripbot/
├── app/
│   ├── page.tsx                # Landing page
│   ├── chat/page.tsx           # Chat interface
│   ├── templates/page.tsx      # Curated template gallery
│   ├── upload/page.tsx         # PDF/screenshot upload + verification
│   ├── api/
│   │   ├── chat/route.ts       # RAG chat endpoint
│   │   ├── trips/route.ts      # Trip save/fetch
│   │   ├── activate/route.ts   # Share code generation
│   │   ├── upload/route.ts     # File upload + LLM extraction
│   │   └── line/webhook/route.ts # LINE Bot webhook handler
│   └── components/
│       ├── ChatWindow.tsx      # Main chat state manager
│       ├── MessageBubble.tsx   # User/bot message styling
│       ├── ItineraryCard.tsx   # Day-by-day itinerary display
│       ├── ActivationBanner.tsx # LINE activation code banner
│       └── TemplateCard.tsx    # Template preview card
├── lib/
│   ├── rag/                    # RAG pipeline
│   │   ├── embedder.ts         # Calls Python embedding service
│   │   ├── retriever.ts        # pgvector query + metadata filtering
│   │   ├── assembler.ts        # Block assembly + LLM prompt
│   │   ├── web-search.ts       # Tavily web search for real-time info
│   │   └── extractor.ts        # Parameter extraction from user messages
│   ├── llm/
│   │   └── client.ts           # Typhoon2-8B via Ollama
│   ├── line/
│   │   ├── client.ts           # LINE SDK wrapper (reply/push messages)
│   │   ├── parser.ts           # Webhook event parser (DM + group)
│   │   └── injector.ts         # Context injection prompt builder
│   └── db/
│       └── index.ts            # Shared Prisma client
├── prisma/
│   ├── schema.prisma           # User, Trip, LineContext models
│   └── seed/                   # pgvector setup + seed scripts
├── services/
│   └── embedding/
│       └── main.py             # FastAPI embedding microservice (BGE-M3)
├── architecture.md             # Detailed architecture doc
└── CLAUDE.md                   # Agent orchestration instructions
```

## Usage

1. Open [http://localhost:3000](http://localhost:3000) — landing page with two options
2. Click "วางแผนการเดินทาง" to enter the chat
3. Type a trip request (e.g. "อยากไปญี่ปุ่น 7 วัน เดือนธันวา")
4. The RAG pipeline retrieves matching itinerary blocks and assembles a day-by-day plan
5. Review the itinerary card, then click "Confirm & Save"
6. Copy the activation code (e.g. `TKY-492`) to use with the LINE Bot

### Templates

1. Click "เลือกแพ็คเกจสำเร็จรูป" from the landing page
2. Browse 4 curated templates (Tokyo & Osaka Classic, Hokkaido Snow, Kyoto Cultural, Tokyo Summer)
3. Click "ใช้แพ็คเกจนี้" to preview the full day-by-day itinerary
4. Confirm to save and get an activation code

### Upload Existing Itinerary

1. Click "มีแผนอยู่แล้ว? อัปโหลดที่นี่" from the landing page
2. Drag-and-drop or select a PDF/image file of your itinerary
3. The LLM extracts a structured itinerary JSON from the content
4. Review and edit, then confirm to save

### LINE Bot

1. In the LINE Developers Console, set webhook URL to `https://<your-domain>/api/line/webhook`
2. Turn Webhooks ON, Auto-reply OFF, Greeting messages OFF
3. In LINE chat, type `/activate TKY-492` to link your trip
4. Ask questions about your itinerary — the bot answers from your saved plan

For local testing, use [ngrok](https://ngrok.com/): `ngrok http 3000`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Send message, get itinerary back via RAG pipeline |
| POST | `/api/trips` | Save finalized trip |
| GET | `/api/trips?userId=...` | Fetch user's saved trips |
| POST | `/api/activate` | Generate LINE activation share code |
| POST | `/api/upload` | Upload file, extract itinerary via LLM |
| POST | `/api/line/webhook` | LINE Bot webhook (signature-validated) |

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full production deployment guide — covers Vercel, GPU server options (Vast.ai, RunPod, AWS), LINE webhook setup, security checklist, and cost estimates.

## Implementation Status

- **Phase 1 — Foundation**: Done (Prisma schema, pgvector, seed data)
- **Phase 2 — Web RAG Chatbot**: Done (RAG pipeline + chat UI + API routes)
- **Phase 3 — LINE Bot**: Done (webhook, /activate command, context injection)
- **Phase 4 — Upload & Templates**: Done (template gallery, upload + LLM extraction, verification UI)
