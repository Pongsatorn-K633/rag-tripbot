# Deployment Guide

This guide covers deploying RAG TripBot to production. The system has two parts: a lightweight web app and AI services.

---

## Architecture Overview

```
                        Internet
                           |
                    +--------------+
                    |   Vercel /   |    Next.js app (no GPU needed)
                    |   VPS        |    Serves frontend + API routes
                    +--------------+
                      |    |    |
         +------------+    |    +-------------+
         |                 |                  |
   +----------+    +-----------+    +------------------+
   | Neon DB  |    | Gemini    |    | LINE Platform    |
   | (Postgres|    | API       |    | (webhook calls   |
   | +pgvector)|   | (cloud)   |    |  your /api/line) |
   +----------+    +-----------+    +------------------+
```

---

## 1. Web App (Next.js)

### Option A: Vercel (Recommended)

Easiest option — zero infrastructure management.

1. Push repo to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Set all environment variables in Vercel dashboard (Settings > Environment Variables)
4. Deploy — Vercel handles build + CDN + HTTPS automatically

Considerations:
- Vercel serverless functions have a **60s timeout** (Pro plan) or **10s** (Hobby). Gemini API calls typically respond in 2-10s, well within limits.
- No file system persistence — uploaded files are processed in memory (which is what we already do).

### Option B: VPS (full control)

Any Linux VPS works (DigitalOcean, Linode, AWS EC2, etc). Minimum spec: 1 vCPU, 1GB RAM.

```bash
# On VPS
git clone <your-repo>
cd rag-tripbot
npm install
npm run build
npm start        # runs on port 3000

# Use nginx or caddy as reverse proxy for HTTPS
```

For process management, use PM2:
```bash
npm install -g pm2
pm2 start npm --name "tripbot" -- start
pm2 save
pm2 startup
```

---

## 2. AI Services

Gemini 2.5 Flash is a cloud API — no GPU server needed. Just set `GEMINI_API_KEY` in your environment.

The embedding service (BGE-M3) is currently **paused** since pgvector search is not active. When re-enabled, it requires:

| Service | VRAM Required | Port |
|---|---|---|
| Embedding service (BGE-M3) | ~2 GB | 8001 |

---

## 3. Database (Neon)

Your Neon database is already cloud-hosted and production-ready. No changes needed.

If you want to self-host PostgreSQL + pgvector instead:
```bash
# Docker
docker run -d --name pgvector \
  -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 \
  pgvector/pgvector:pg17
```

---

## 4. Environment Variables for Production

```env
# Database (keep your existing Neon URLs)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Embedding service (paused — only needed when pgvector search is re-enabled)
EMBEDDING_SERVICE_URL=http://localhost:8001

# LINE Bot (from LINE Developers Console)
LINE_CHANNEL_SECRET=<actual secret>
LINE_CHANNEL_ACCESS_TOKEN=<actual token>
```

---

## 5. LINE Bot Webhook

The LINE webhook needs a public HTTPS URL. Set it in the [LINE Developers Console](https://developers.line.biz/):

- If on Vercel: `https://your-app.vercel.app/api/line/webhook`
- If on VPS: `https://your-domain.com/api/line/webhook` (requires HTTPS via nginx/caddy)

Settings to configure:
- Webhooks: **ON**
- Auto-reply messages: **OFF**
- Greeting messages: **OFF**

---

## 6. Security Checklist

Before going live:

- [ ] Remove default Neon credentials from `.env` — use environment variables in your hosting platform
- [ ] Ensure `.env` is in `.gitignore` (it already is)
- [ ] Enable HTTPS on all public endpoints
- [ ] Set `NODE_ENV=production` on the web server
- [ ] Consider rate limiting on `/api/chat` and `/api/upload` to prevent abuse

---

## Recommended Setup for Low-Cost Production

For a small-scale deployment (personal use or demo):

| Component | Provider | Monthly Cost |
|---|---|---|
| Web app | Vercel (Hobby) | Free |
| Database | Neon (Free tier) | Free |
| LLM | Gemini 2.5 Flash (free tier: 15 RPM) | Free |
| Domain | Any registrar | ~$10/yr |
| **Total** | | **Free (within free tier limits)** |

For higher traffic, Gemini API pricing applies (pay-per-token). See [Google AI pricing](https://ai.google.dev/pricing) for current rates.
