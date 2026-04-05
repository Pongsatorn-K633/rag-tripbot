# Deployment Guide

This guide covers deploying RAG TripBot to production. The system has two parts: a lightweight web app and GPU-heavy AI services.

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
   | Neon DB  |    | GPU Server|    | LINE Platform    |
   | (Postgres|    | - Ollama  |    | (webhook calls   |
   | +pgvector)|   | - Embed   |    |  your /api/line) |
   +----------+    | service   |    +------------------+
                   +-----------+
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
- Vercel serverless functions have a **60s timeout** (Pro plan) or **10s** (Hobby). The RAG chat calls Ollama which can take 10-30s depending on GPU. If timeouts are an issue, upgrade to Pro or use streaming.
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

## 2. GPU Server (AI Services)

This is the most critical decision. You need GPU to run:

| Service | VRAM Required | Port |
|---|---|---|
| Ollama (Typhoon2-8B) | ~6 GB | 11434 |
| Ollama (Qwen2.5-VL 7B) | ~6 GB | 11434 (shared) |
| Embedding service (BGE-M3) | ~2 GB | 8001 |

**Total: ~14 GB VRAM** if all models loaded simultaneously. Ollama swaps models in/out of VRAM automatically, so **8-10 GB VRAM** works if you're okay with cold-start latency when switching between Typhoon2 and Qwen2.5-VL.

### Option A: Vast.ai / RunPod (Cheapest GPU rental)

Best for development and low-traffic production. Pay per hour.

| Provider | GPU | VRAM | Approx. Cost |
|---|---|---|---|
| [Vast.ai](https://vast.ai) | RTX 3090 / 4090 | 24 GB | $0.20-0.50/hr |
| [RunPod](https://runpod.io) | RTX 4090 | 24 GB | $0.40-0.75/hr |
| [Lambda](https://lambdalabs.com) | A10G | 24 GB | $0.75/hr |

Setup on Vast.ai / RunPod:
```bash
# SSH into GPU instance
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull scb10x/llama3.1-typhoon2-8b-instruct
ollama pull qwen2.5vl:7b

# Start Ollama (listen on all interfaces)
OLLAMA_HOST=0.0.0.0 ollama serve

# Start embedding service
pip install fastapi uvicorn sentence-transformers torch
python services/embedding/main.py
```

Make sure ports 11434 and 8001 are open in the firewall/security group.

### Option B: Your own machine with GPU

If you have a desktop with an NVIDIA GPU (RTX 3060 12GB or better), you can run the AI services locally and expose them via a tunnel.

```bash
# On your GPU machine
ollama serve
python services/embedding/main.py

# Expose to the internet (pick one)
ngrok http 11434          # for Ollama
ngrok http 8001           # for embedding service
# or use Cloudflare Tunnel, Tailscale, etc.
```

### Option C: Cloud GPU (AWS / GCP)

More expensive but production-grade with SLAs.

| Provider | Instance | GPU | VRAM | Approx. Cost |
|---|---|---|---|---|
| AWS | g5.xlarge | A10G | 24 GB | ~$1.00/hr |
| GCP | g2-standard-4 | L4 | 24 GB | ~$0.70/hr |
| Azure | NC4as_T4_v3 | T4 | 16 GB | ~$0.53/hr |

The T4 (16 GB) is the minimum viable option — it can run the models but will swap between them.

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

# Point to your GPU server's public IP or domain
EMBEDDING_SERVICE_URL=http://<gpu-server-ip>:8001
OLLAMA_BASE_URL=http://<gpu-server-ip>:11434
OLLAMA_VISION_MODEL=qwen2.5vl:7b

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
- [ ] Restrict GPU server ports (11434, 8001) to only your web server's IP
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
| GPU server | Vast.ai RTX 3090 (on-demand) | ~$50-150/mo depending on usage |
| Domain | Any registrar | ~$10/yr |
| **Total** | | **~$50-150/mo** |

For always-on production, the GPU server is the main cost. Consider:
- Using Vast.ai spot instances (cheaper but can be interrupted)
- Shutting down the GPU server when not in use (evenings/weekends)
- Switching to API-based LLM (e.g., OpenAI, Anthropic) to eliminate GPU costs entirely — would require rewriting `lib/llm/client.ts` only
