# RAG TripBot

A two-chatbot system for Japan trip planning, targeting Thai travelers.

- **Web App** (Next.js) — Planning phase: a Hybrid Modular RAG chatbot that assembles day-by-day itineraries from pre-built blocks stored in pgvector.
- **LINE Bot** — Execution phase: a context injection chatbot that answers trip-specific questions on the go using the finalized itinerary.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Backend API | Next.js API Routes |
| ORM | Prisma v6 (`@prisma/adapter-pg`) |
| Database | Neon (PostgreSQL + pgvector) |
| Embedding | BAAI/bge-m3 (1024-dim) via FastAPI microservice |
| LLM | Gemini 2.5 Flash (text + vision) |
| Web Search | Gemini with Google Search grounding |
| LINE | LINE Messaging API + Webhook |

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **Gemini API key** (from [Google AI Studio](https://aistudio.google.com/))
- **Neon** database (or any PostgreSQL with pgvector)

## Setup

### 1. Install dependencies

This project uses **two runtimes** — Node.js for the web app and Python for the embedding microservice.

**Node.js dependencies:**

```bash
npm install                       # Next.js, Prisma, LINE SDK, etc.
```

**Python dependencies** — create and activate a virtual environment first (recommended,
since `torch` + `sentence-transformers` are large and best kept isolated):

```bash
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt   # FastAPI, sentence-transformers, torch, etc.

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Keep the venv activated whenever you run the embedding service (step 4).

### 2. Configure environment variables

Create a `.env` file at the project root with the following. Only `.env` is loaded
(by Next.js and by `dotenv/config` in the Prisma config + seed scripts) — there is no
need for a separate `.env.dev` or `.env.development` file.

```env
# ── Database (Neon) ──────────────────────────────────────────────────────────
DATABASE_URL="postgresql://..."       # Neon pooled connection
DIRECT_URL="postgresql://..."         # Neon direct connection (for migrations)

# ── RAG / LLM ────────────────────────────────────────────────────────────────
EMBEDDING_SERVICE_URL=http://localhost:8001          # Paused — only needed when pgvector search is re-enabled
GEMINI_API_KEY=your_gemini_api_key                   # From Google AI Studio

# ── LINE Bot ─────────────────────────────────────────────────────────────────
LINE_CHANNEL_SECRET=your_channel_secret              # From LINE Developers Console
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token  # From LINE Developers Console
LIFF_ID=your_liff_id                                 # From LINE Developers Console (LIFF tab)
LINE_BOT_USER_ID=your_bot_user_id                    # Bot's own userId (for self-mention filtering)

# ── Auth (NextAuth v5) ───────────────────────────────────────────────────────
AUTH_URL="http://localhost:3000"                     # Site URL (production domain in prod)
AUTH_SECRET=your_auth_secret                         # `openssl rand -base64 32`
AUTH_TRUST_HOST=true
SUPERADMIN_EMAILS="you@example.com"                  # Comma-separated; auto-promoted on first sign-in
GOOGLE_CLIENT_ID=your_google_oauth_client_id         # Google Cloud Console
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# ── Email (magic link via Resend) ────────────────────────────────────────────
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM="dopamichi <auth@yourdomain.com>"

# ── Cloudinary (cover + profile image uploads) ───────────────────────────────
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_covers_preset
NEXT_PUBLIC_CLOUDINARY_PROFILE_PRESET=your_profiles_preset

# ── Rate limiting (Upstash Redis) ────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
```

### 3. Run database migrations and seed

> **Only run this section when initializing a brand-new, empty database.** The database
> lives in the cloud (Neon), so if your `.env` points at the existing one — the usual case,
> including any fresh clone — the schema, pgvector table, and seed blocks are already there.
> Skip to step 4. Re-running `db:seed` in particular would **wipe and re-insert** the seed
> blocks, deleting any data added since.

```bash
npx prisma db push              # Apply relational schema (preserves the Unsupported vector(1024) table)
npm run db:setup-pgvector       # Create itinerary_blocks table + HNSW index
npm run db:seed                 # Seed sample itinerary blocks
```

> The schema declares `itinerary_blocks` as `Unsupported("vector(1024)")`, so use
> `prisma db push` rather than `prisma migrate dev` to avoid dropping the pgvector table.

### 4. Start the embedding service (optional — currently paused)

> **Only needed for the RAG chat search feature** (`/chat` → `/api/chat`), which embeds the
> user's query and runs a pgvector similarity search over `itinerary_blocks`. That route is
> currently redirected to `/maintenance`, so you can **skip this step** for everyday dev.
> The templates gallery, file upload + VLM extraction, the LINE bot, and auth/admin all work
> without it. (This is also the heaviest step — it downloads the ~2GB BGE-M3 model.)

```bash
python services/embedding/main.py
```

This starts the BGE-M3 embedding microservice on port 8001. Keep it running in a separate terminal.

### 5. Start the dev server

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
│   ├── liff/
│   │   └── itinerary/page.tsx  # LIFF page — dark-themed day-by-day accordion
│   ├── api/
│   │   ├── chat/route.ts       # RAG chat endpoint
│   │   ├── trips/route.ts      # Trip save/fetch
│   │   ├── trips/by-code/route.ts # Fetch trip by shareCode (for LIFF)
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
│   │   ├── web-search.ts       # searchWeb() for assembler + generateWithSearch() for LINE enriched path
│   │   └── extractor.ts        # Parameter extraction from user messages
│   ├── llm/
│   │   └── client.ts           # Gemini 2.5 Flash client (generateText, generateFromVision)
│   ├── line/
│   │   ├── client.ts           # LINE SDK wrapper (replyToLine, pushToLine, replyFlexMessage)
│   │   ├── parser.ts           # Webhook event parser (DM + group)
│   │   └── injector.ts         # Context injection + hybrid intent classification (regex + LLM)
│   └── db/
│       └── index.ts            # Shared Prisma client
├── prisma/
│   ├── schema.prisma           # User, Trip, LineContext models
│   └── seed/                   # pgvector setup + seed scripts
├── services/
│   └── embedding/
│       └── main.py             # FastAPI embedding microservice (BGE-M3)
├── docs/architecture.md        # Detailed architecture doc
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
5. Type "ขอดูแผน" (or similar) to view the full itinerary — the bot sends a Flex Message with a "ดูแผนเต็ม" button that opens a dark-themed LIFF page

The bot uses **hybrid intent classification**: a regex fast gate catches clean phrases like "ขอดูแผน" with zero API calls; typos like "plna pls" fall through to a single Gemini call that does intent classification (`[SHOW_PLAN]`) and question answering in one shot — no extra API cost. "สรุปทริป" is answered as a summary, not treated as a full plan view.

#### Local LINE bot development with ngrok

LINE can only deliver webhooks to a public HTTPS URL, so to develop the bot against your
local `npm run dev` server you tunnel port 3000 through [ngrok](https://ngrok.com/).

**One-time setup** (do this once per machine):

1. Download ngrok from [ngrok.com/download](https://ngrok.com/download) and unzip / install it
   (on Windows, put `ngrok.exe` somewhere on your `PATH`, or run it from its folder).
2. Add your authtoken from the [ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken):

   ```bash
   ngrok config add-authtoken <your-authtoken>
   ```

3. Verify it works:

   ```bash
   ngrok version            # prints the installed version
   ```

   This writes the token to your ngrok config file, so you never need to repeat it.

**Each dev session:**

1. **Start the app** (terminal 1):

   ```bash
   npm run dev                  # http://localhost:3000
   ```

2. **Start the tunnel** (terminal 2):

   ```bash
   taskkill /F /IM ngrok.exe    # Kill any existing tunnel (Windows; ignore "not found")
   ngrok http 3000
   ```

   Copy the `https://<id>.ngrok-free.app` "Forwarding" URL it prints.
   
   Ex: `ngrok http --url=https://pearlie-accusable-unintuitively.ngrok-free.dev 3000`

3. **Point LINE at the tunnel** — in the [LINE Developers Console](https://developers.line.biz/console/):
   - **Messaging API → Webhook URL:** `https://<id>.ngrok-free.app/api/line/webhook`, then
     click **Verify** (expects 200) and ensure **Use webhook** is ON, Auto-reply OFF, Greeting OFF.
   - **LIFF → your LIFF app → Endpoint URL:** `https://<id>.ngrok-free.app/liff/itinerary`
     (only needed if you're testing the "ดูแผนเต็ม" full-plan button locally; otherwise it keeps
     opening the production page).

4. Add the bot as a friend / invite to a group and test: `/activate <CODE>`, then ask a question.

5. **When done, switch the webhook back to production** so the deployed bot works again.

**Console URL reference** — settings that live in the LINE console (not in code).

**1. Messaging API → Webhook URL** (receives bot messages) — **swap this** between prod and
local dev. The channel holds exactly one value:

| Mode | Webhook URL |
|---|---|
| **Production** (Vercel / `dopamichi.com`) | `https://dopamichi.com/api/line/webhook` |
| **Local dev** (ngrok static domain) | `https://pearlie-accusable-unintuitively.ngrok-free.dev/api/line/webhook` |

**2. LIFF → (your LIFF app) → Endpoint URL** — **leave this on production. Do NOT swap it
to dev.** There is only one LIFF app and it's shared with live users, so pointing its
Endpoint at ngrok would send everyone's "ดูแผนเต็ม" button to your laptop (and break it when
ngrok is off). Keep it at:

```
https://dopamichi.com/liff/itinerary
```

To preview your **local** LIFF page (theme toggle, choices, light mode), just open the ngrok
URL directly in a browser with a `shareCode` — it renders the exact same page, no console
change, no risk to production:

```
https://pearlie-accusable-unintuitively.ngrok-free.dev/liff/itinerary?shareCode=KYO-235
```

(or `http://localhost:3000/liff/itinerary?shareCode=KYO-235`). Only ever change the LIFF
Endpoint URL if you must test the full in-LINE button→LIFF chain — and revert it immediately.

> The Webhook URL above is not a secret and the app code never calls it — it lives only in the
> LINE Developers Console. **When deploying to production, set the Webhook URL back to the
> `dopamichi.com` value** (the LIFF Endpoint URL should already be on production).

> ⚠️ A free *random* `*.ngrok-free.app` subdomain **changes every restart**, so you'd have to
> re-paste the webhook URL each time. To avoid this, claim your free
> [static domain](https://dashboard.ngrok.com/domains) and run
> `ngrok http --domain=<your-name>.ngrok-free.app 3000` — the URL then stays stable across restarts.

> Webhook signatures are validated against `LINE_CHANNEL_SECRET` ([app/api/line/webhook/route.ts:14](app/api/line/webhook/route.ts#L14)),
> so make sure your local `.env` has the same `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`
> as the channel you point the webhook at — otherwise every event is rejected with 403.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Send message, get itinerary back via RAG pipeline |
| POST | `/api/trips` | Save finalized trip |
| GET | `/api/trips?userId=...` | Fetch user's saved trips |
| POST | `/api/activate` | Generate LINE activation share code |
| GET | `/api/trips/by-code?shareCode=...` | Fetch trip itinerary by shareCode (used by LIFF page) |
| POST | `/api/upload` | Upload file, extract itinerary via LLM |
| POST | `/api/line/webhook` | LINE Bot webhook (signature-validated) |

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full production deployment guide — covers Vercel, GPU server options (Vast.ai, RunPod, AWS), LINE webhook setup, security checklist, and cost estimates.

## Implementation Status

- **Phase 1 — Foundation**: Done (Prisma schema, pgvector, seed data)
- **Phase 2 — Web RAG Chatbot**: Done (RAG pipeline + chat UI + API routes)
- **Phase 3 — LINE Bot**: Done (webhook, /activate command, context injection, LIFF view, hybrid intent classification)
- **Phase 4 — Upload & Templates**: Done (template gallery, upload + LLM extraction, verification UI)
- **Phase 5 — Auth + Admin System**: Done (NextAuth v5 with Google OAuth + magic link, role-based access (USER/ADMIN/SUPERADMIN), admin dashboard, superadmin user management, Template table + saved templates, Cloudinary cover/profile uploads, Upstash rate limiting, dark mode + onboarding)

> **Note:** `/chat` is temporarily redirected to `/maintenance` via `next.config.ts`; the chat UI is preserved and will be re-enabled. See `docs/architecture.md`.

## Image assets

All stock photos are currently served from Google's `lh3.googleusercontent.com` CDN. These are temporary preview URLs generated by Gemini Stitch and are not guaranteed to be stable long-term. Every URL is centralised in `lib/images.ts` — that is the single source of truth.

### Migrating a single image to Cloudinary

1. Upload the asset to the `dopamichi/` folder in the Cloudinary console (cloud name: `dubett62q`).
2. Note the public ID (folder path without file extension), e.g. `dopamichi/home/hero`.
3. Open `lib/images.ts` and replace the lh3 URL for that slot with a `cld()` call:
   ```ts
   homeHero: cld('home/hero', { w: 1200 }),
   ```
4. The `cld()` helper applies `f_auto,q_auto` transforms by default and accepts optional width, height, and crop parameters.

### Environment variable

Add to `.env` (the user handles secrets — do not commit this):

```
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@dubett62q
```

`next-cloudinary` parses `CLOUDINARY_URL` automatically. The cloud name `dubett62q` is already baked into `lib/images.ts` as `CLOUDINARY_CLOUD`.
