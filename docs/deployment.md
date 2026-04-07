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

---

## Step-by-Step Walkthrough — How dopamichi.com was actually deployed

This is the literal sequence we followed for the first prod deploy, including
every error we hit and how we fixed it. Use this as a runbook for future
re-deploys or for setting up a second environment.

### Stage 0 — Local pre-flight

```bash
git status              # working tree clean (or only intentional changes)
npx tsc --noEmit        # must pass with zero errors
npm run build           # must finish with "✓ Compiled successfully"
```

**Gotcha we hit:** ESLint rule `react-hooks/set-state-in-effect` blocked the
build because `app/liff/itinerary/page.tsx` called `setError(...)` synchronously
inside a `useEffect`. Fix: derive the initial `loading` / `error` state from the
`shareCode` query param using `useState(() => ...)` instead of setting it in the
effect. The effect should only handle the async fetch.

### Stage 1 — Push to GitHub

```bash
git add -A
git commit -m "..."
git push origin main
```

Vercel auto-deploys on every push to `main` once the project is connected
(see Stage 2). No manual trigger needed.

### Stage 2 — Import the project to Vercel

1. Go to **https://vercel.com/new**
2. Sign in with GitHub → grant access to the `rag-tripbot` repo
3. Click **Import** next to the repo
4. Configuration screen — leave all defaults (Framework Preset: Next.js,
   Root Directory: `./`, Build Command: `next build`)
5. **Expand Environment Variables** and paste in everything from §4 above.
   Mark each as **Production + Preview + Development** unless you have a
   reason not to.
6. Click **Deploy**

**Gotcha we hit:** First deploy failed with
`Type error: Module '"@prisma/client"' has no exported member 'PrismaClient'`.
Cause: Prisma v7 doesn't auto-generate the client during `npm install`, and
Vercel starts from a clean `node_modules`. Fix: add a `postinstall` hook to
`package.json` so Vercel runs `prisma generate` after install:

```json
"scripts": {
  "build": "prisma generate && next build",
  "postinstall": "prisma generate"
}
```

Push the change → Vercel auto-redeploys → green build.

### Stage 2.5 — Set the runtime region

Default is `iad1` (Washington DC). For Thai/Japan users this adds ~250ms
round-trip latency on every API call. Move it:

1. Vercel → your project → **Settings → Functions → Function Region**
2. Select **Singapore (sin1)**
3. Save → **Redeploy** the latest deployment (⋯ menu → Redeploy → uncheck
   "Use existing Build Cache")

> **Hobby plan note:** the `vercel.json` `regions` field is **ignored on
> Hobby** — only the dashboard setting matters. The build itself still runs
> in `iad1` regardless (Vercel doesn't move build infra on Hobby), but
> function execution moves to `sin1`. Verify with:
>
> ```bash
> curl -I https://dopamichi.com/api/trips
> ```
>
> Look for `x-vercel-id: sin1::...` in the response.

### Stage 3 — Custom domain via Cloudflare

**3a — Add the domain in Vercel first**

1. Vercel → Settings → **Domains**
2. Add `dopamichi.com` → click Add
3. Add `www.dopamichi.com` → click Add
4. Vercel will display the DNS records to set — copy them down

**3b — Set DNS in Cloudflare**

1. Cloudflare dashboard → click `dopamichi.com`
2. **DNS → Records**
3. **Delete any pre-existing parking A/CNAME records** for `@` and `www`
4. Add the records Vercel gave you, typically:

   | Type | Name | Value | Proxy |
   |---|---|---|---|
   | A | `@` | `76.76.21.21` | 🔴 DNS only (gray cloud) |
   | CNAME | `www` | `cname.vercel-dns.com` | 🔴 DNS only (gray cloud) |

5. **Critical:** Both records must be **DNS only** (gray cloud), NOT proxied
   (orange cloud). Cloudflare's proxy intercepts the SSL handshake and
   breaks Vercel's cert provisioning. You can flip them to Proxied later
   if you want, but only after Vercel shows the green checkmark.

**3c — Wait for green checkmark**

Vercel auto-provisions the SSL cert as soon as DNS resolves. Usually 1–5
minutes on Cloudflare. Both `dopamichi.com` and `www.dopamichi.com` should
eventually show "Valid Configuration" with a green check.

**3d — Set the canonical primary domain**

When both domains are configured as "Connect to Environment", Vercel
silently picks one as primary and 308-redirects the other. You want
explicit control:

1. Vercel → Settings → Domains
2. `dopamichi.com` row → leave as **"Connect to an environment"** (Production)
3. `www.dopamichi.com` row → change to **"Redirect to Another Domain"** →
   pick `dopamichi.com` → Save

Result: `dopamichi.com` returns 200 directly, `www.dopamichi.com` 308s
to the apex. **This step is what makes LINE webhook verification work**
(see Stage 4 gotcha).

### Stage 4 — LINE Developers Console

**4a — Messaging API webhook**

1. https://developers.line.biz/console/ → your provider → your Messaging
   API channel → **Messaging API** tab
2. Webhook URL → Edit → `https://dopamichi.com/api/line/webhook`
3. Click **Verify** → must return **Success** ✅
4. Toggles:
   - Use webhook: **ON**
   - Auto-reply messages: **OFF**
   - Greeting messages: **OFF**

**Gotcha we hit:** Verify returned
`The webhook returned an HTTP status code other than 200 (308 Permanent Redirect)`.
Cause: LINE doesn't follow redirects on webhook verification. Either:
- The wrong primary domain was set in Vercel (using `https://dopamichi.com`
  while Vercel had `www.` as primary), OR
- The two domain rows in Vercel were both "Connect to environment" with
  no explicit redirect direction

Fix: Stage 3d above — make `dopamichi.com` the canonical and explicitly
redirect `www.` to it. Then re-Verify. This is the most common deployment
gotcha for any platform that fronts a custom domain through a registrar/CDN.

**4b — LIFF endpoint**

1. Same channel → **LIFF** tab
2. Edit your existing LIFF app
3. Endpoint URL → `https://dopamichi.com/liff/itinerary`
4. Size: Full
5. Update → copy the LIFF ID
6. Verify Vercel env var `LIFF_ID` matches → if you changed it, **redeploy**
   (Vercel does NOT auto-redeploy on env var changes)

**4c — Publish the channel**

1. Same channel → **Basic settings** tab → bottom of page
2. Channel status: Developing → click **Publish** → confirm
3. The "can't undo" warning is misleading — published just means the bot
   is reachable by anyone who adds it (your testers). It doesn't broadcast
   or appear in any directory. Publishing is required for non-admin users
   to chat with the bot.

### Stage 5 — End-to-end smoke test

Walk through each of these in order. Stop at the first failure.

| # | Test | Expected |
|---|---|---|
| 1 | Open `https://dopamichi.com` in browser | Homepage renders, gold logo, two CTAs |
| 2 | Click **เลือกแพ็คเกจสำเร็จรูป** → pick Tokyo Classic → confirm | Modal shows share code (e.g. `TKY-492`) |
| 3 | In LINE, add the bot → message `/activate TKY-492` | Bot replies with confirmation |
| 4 | Ask the bot `แผนวันที่ 2 มีอะไรบ้าง` | Correct day-2 answer in Thai |
| 5 | Ask the bot `ขอดูแผนทั้งหมด` | Flex Message with **เปิดดูแผน** button |
| 6 | Tap the button | Opens dopamichi.com LIFF page with full itinerary |
| 7 | Open `https://dopamichi.com/upload` → drop an `.xlsx` itinerary | Extracts → review screen → save → share code |
| 8 | Repeat #7 with an image file (PNG/JPG) | Extracts correctly |
| 9 | Repeat #7 with a PDF file | Extracts correctly |

### Common failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Vercel build fails: `PrismaClient not exported` | Missing `prisma generate` step | Add `postinstall` script (Stage 2 gotcha) |
| Vercel build fails: ESLint `react-hooks/set-state-in-effect` | Synchronous setState in `useEffect` | Refactor to derive initial state via `useState(() => ...)` |
| LINE webhook verify: 308 redirect | Vercel domain has wrong primary | Stage 3d — explicit redirect from www to apex |
| LINE webhook verify: 401/signature | Wrong `LINE_CHANNEL_SECRET` env var | Recheck secret in Vercel, redeploy |
| LIFF page loads but can't read shareCode | LIFF unwraps query params into `liff.state` | Already handled in `app/liff/itinerary/page.tsx` |
| `/api/upload` 504 timeout on Vercel | Hobby 60s limit hit | Already pinned `maxDuration: 60` in `vercel.json`. If still hitting, upgrade plan or shrink prompt |
| Function still runs in iad1 after region change | Cached deployment | Force a fresh redeploy (uncheck "Use existing Build Cache") |
| Cloudflare DNS won't resolve | Records still proxied (orange cloud) | Switch to DNS only (gray cloud) — Stage 3b critical note |
