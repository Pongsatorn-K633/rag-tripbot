import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async redirects() {
    return [
      // ── MAINTENANCE MODE ────────────────────────────────────────────────
      // /chat is temporarily offline while we tune the RAG pipeline.
      // The original chat UI in app/chat/page.tsx is PRESERVED — to re-enable,
      // simply remove this redirect block. See docs/architecture.md.
      {
        source: '/chat',
        destination: '/maintenance',
        permanent: false,
      },
      // ── RENAME: Templates → Pre-planned ─────────────────────────────────
      // The gallery moved from /templates to /pre-planned. Keep old links,
      // bookmarks, and shared URLs working. (API routes under /api/templates
      // are unchanged — this only affects the user-facing page.)
      {
        source: '/templates',
        destination: '/pre-planned',
        permanent: true,
      },
      // ── RENAME: Go! → My Trip ───────────────────────────────────────────
      {
        source: '/go',
        destination: '/my-trip',
        permanent: true,
      },
      // ── RENAME: Gallery → Doc-to-Trip ───────────────────────────────────
      // The doc-upload (VLM extraction) page moved from /gallery. Keep old
      // links/bookmarks working.
      {
        source: '/gallery',
        destination: '/doc-to-trip',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
