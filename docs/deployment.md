# Deployment Guide

This guide covers deploying RAG TripBot to production. The system has two parts: a lightweight web app and AI services.

**Production domain:** `dopamichi.com` (purchased)
**Hosting target:** Vercel
**Database:** Neon (already provisioned)
**LINE webhook URL:** `https://dopamichi.com/api/line/webhook`
**LIFF endpoint URL:** `https://dopamichi.com/liff/itinerary`

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

### Option A: Vercel (Recommended — what we're using)

Easiest option — zero infrastructure management.

1. Push repo to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Set all environment variables in Vercel dashboard (Settings → Environment Variables)
4. Deploy — Vercel handles build + CDN + HTTPS automatically
5. **Add custom domain** in Vercel → Settings → Domains:
   - Add `dopamichi.com` and `www.dopamichi.com`
   - Vercel shows the DNS records to set at the registrar (typically an `A` record `@ → 76.76.21.21` and a `CNAME www → cname.vercel-dns.com`)
   - Wait for DNS propagation (usually 5–30 min) and SSL provisioning (automatic)

Considerations:
- Vercel serverless functions have a **60s timeout** (Pro plan) or **10s** (Hobby). The `/api/upload` route can take 8–11s for spreadsheet extraction — **on Hobby plan it may time out**. Test the upload flow first; if it hits the limit, upgrade to Pro or move uploads to a long-running runtime.
- No file system persistence — uploaded files are processed in memory (which is what we already do).
- Set `nodejs` runtime explicitly on the upload route if Vercel defaults to edge runtime (edge doesn't support `xlsx` package).

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

Set these in **Vercel → Settings → Environment Variables** (mark all as
Production + Preview + Development as appropriate):

```env
# Database (Neon)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Gemini API
GEMINI_API_KEY=<your_gemini_api_key>

# Embedding service (paused — only needed when pgvector search is re-enabled)
EMBEDDING_SERVICE_URL=http://localhost:8001

# LINE Bot (from LINE Developers Console)
LINE_CHANNEL_SECRET=<actual secret>
LINE_CHANNEL_ACCESS_TOKEN=<actual token>

# LIFF (from LINE Developers Console → LIFF tab)
LIFF_ID=<actual liff id>

# Public site URL — used by server code to build absolute links
NEXT_PUBLIC_SITE_URL=https://dopamichi.com
```

> ⚠️ Do NOT copy `.env` into the Vercel dashboard blindly — the local
> Neon URLs may differ from the prod ones, and `EMBEDDING_SERVICE_URL`
> pointing at `localhost` is fine because that path is currently inactive.

---

## 5. LINE Bot Webhook & LIFF

After the Vercel deploy is live on `dopamichi.com`, update the
[LINE Developers Console](https://developers.line.biz/):

### Messaging API channel

- **Webhook URL:** `https://dopamichi.com/api/line/webhook`
- **Use webhook:** ON
- **Auto-reply messages:** OFF
- **Greeting messages:** OFF
- Click **Verify** in the console — must return `Success`.

### LIFF app

The LIFF view (`/liff/itinerary`) needs its endpoint URL pointed at
the production domain:

- **Endpoint URL:** `https://dopamichi.com/liff/itinerary`
- **Size:** Full
- **Scope:** `profile`, `openid` (whatever was already configured)
- Copy the **LIFF ID** into the `LIFF_ID` env var on Vercel.

### Smoke test after deploy

1. Open `https://dopamichi.com` — homepage renders
2. Pick a curated template → save → share code shown
3. In LINE, message the bot: `/activate <code>` → bot confirms
4. Ask the bot: `แผนวันที่ 2 มีอะไรบ้าง` → answers from Trip JSON
5. Ask the bot: `ขอดูแผนทั้งหมด` → Flex Message with LIFF button → opens dopamichi.com

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

---

## Pre-Deploy Checklist (First Production Push)

Run through this top-to-bottom before flipping DNS.

**Repo / code**
- [ ] All changes committed and pushed to GitHub `main`
- [ ] `npx tsc --noEmit` passes locally
- [ ] `npm run build` passes locally
- [ ] No secrets committed (check `git log -p .env` is empty)

**Vercel project**
- [ ] Repo imported at vercel.com/new
- [ ] Framework preset: **Next.js** (auto-detected)
- [ ] All env vars from §4 set (Production scope)
- [ ] First deploy succeeds on the temporary `*.vercel.app` URL
- [ ] Visit `/` and `/templates` and `/upload` on the temp URL — all render

**Custom domain**
- [ ] `dopamichi.com` added in Vercel → Settings → Domains
- [ ] DNS records set at the registrar per Vercel's instructions
- [ ] HTTPS cert provisioned (green lock in browser)
- [ ] `https://dopamichi.com` resolves and serves the homepage

**LINE platform**
- [ ] Webhook URL updated to `https://dopamichi.com/api/line/webhook`
- [ ] Webhook **Verify** returns Success
- [ ] LIFF endpoint updated to `https://dopamichi.com/liff/itinerary`
- [ ] `LIFF_ID` env var on Vercel matches the LIFF app's ID

**End-to-end smoke test**
- [ ] Save a curated template → share code generated
- [ ] `/activate <code>` in LINE → confirmation reply
- [ ] Free-form question → correct answer from Trip JSON
- [ ] "ขอดูแผนทั้งหมด" → LIFF button opens itinerary view
- [ ] Upload an `.xlsx` itinerary → extraction succeeds → save → share code
- [ ] Upload an image of an itinerary → extraction succeeds
- [ ] Upload a PDF itinerary → extraction succeeds

**Post-deploy**
- [ ] Revoke / stop any local ngrok tunnel that was previously pointed at LINE
- [ ] Bookmark Vercel logs URL and Neon dashboard for quick monitoring
- [ ] Note Gemini free-tier limit: 15 RPM — fine for closed beta, monitor if you share widely
