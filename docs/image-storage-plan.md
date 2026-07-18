# Image Storage & Delivery Plan (Cloudinary today → Cloudflare R2 later)

> Written 2026-07-19, after moving ALL `next/image` traffic off Vercel Image
> Optimization (its Hobby quota of 5K transformations/month was exhausted
> double-optimizing files Cloudinary had already optimized). The global loader
> is [`lib/image-loader.ts`](../lib/image-loader.ts), wired in
> [`next.config.ts`](../next.config.ts) — Cloudinary does responsive resizing
> itself; Vercel does zero transformations.

## Where images live today

| Source | What | Notes |
|---|---|---|
| **Cloudinary** (`dopamichi/*`) | ALL content images: trip covers + galleries, stock images (IMG registry), profile uploads | Full transform pipeline: `c_fill,g_auto,ar_4:5` card crops, `w_1600` heroes, `f_auto,q_auto`, loader width steps |
| **Local `/public`** | Navbar logo, favicons + manifest icons | Stays local forever — favicons are fetched directly by browsers; logo is tiny/cached (kept local after the expired-Google-URL incident) |
| **Google `lh3`** | OAuth avatars (users without an uploaded picture) | Not ours to move; Google serves pre-sized |

Content images are already 100% Cloudinary — no consolidation needed.

## The lock-in to unwind (before any provider move)

The DB stores **full Cloudinary URLs** (`Template.coverImage`, `coverImages[]`,
jsonb `overview.cover_images`, uploaded `User.image`). That, plus the
Cloudinary-API-coupled admin tooling, is the real migration cost — not serving.

R2 itself does **no transformations**: pair it with Cloudflare Image Resizing
(`/cdn-cgi/image/width=…,fit=cover,gravity=auto,format=auto/` in front of R2).
Every transform we use has an equivalent (Cloudinary `g_auto` ↔ Cloudflare
`gravity=auto` — roughly; Cloudinary's smart crop is better).

## Phase 1 — now, cheap (worth it even if we never migrate)

1. **Policy: no component builds an image URL itself.** All URL construction
   lives in `lib/cover-image.ts` (card + hero crops), `lib/image-loader.ts`
   (responsive widths), `lib/images.ts` (IMG registry). Already ~true — keep it.
2. Tidy `/public`: delete dead leftovers (`old-mascot*`, unused
   `japan-hero.jpg`).

## Phase 2 — R2 prep (before migrating anything)

1. **Store provider-agnostic KEYS, not URLs** in the DB
   (`dopamichi/covers/abc123`): resolvers build the full URL per provider.
   Migration script + dual-read (legacy full URLs keep working) during
   transition.
2. **One provider switch** for the three transform recipes (card crop / hero /
   width step): Cloudinary syntax today, `/cdn-cgi/image/` syntax when flipped.

## Phase 3 — the actual R2 move (only when traffic/cost justifies it)

1. Copy assets Cloudinary → R2 (script via Cloudinary Admin API listing).
2. Flip the provider switch; keep dual-read so old URLs never break.
3. **Biggest work — the upload paths**: `CoverUpload`, the profile cropper's
   upload preset, and the admin Cloudinary library browser (Search API, delete,
   stale-cover sweep) are Cloudinary-API-coupled. They need R2 presigned
   uploads + own listing/delete equivalents. Budget most effort here.

## Recommendation

Phase 1–2 whenever convenient. **Defer Phase 3 until real traffic**: R2's win
is zero egress at scale; pre-launch, Cloudinary's free tier costs nothing and
its smart cropping is doing real work. When Phase 3 arrives, authorize the
claude.ai **Cloudflare connector** so the R2 buckets can be managed directly
from Claude Code sessions.
