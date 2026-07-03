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
      // ── RENAME: /pre-planned → /discover ────────────────────────────────
      // The curated gallery's route has changed a few times; only /pre-planned
      // is kept as a redirect since it may have been shared publicly / is the
      // LIFF-adjacent name. (/templates & /plan redirects dropped — pre-launch,
      // no traffic. /api/templates backend is unchanged.)
      {
        source: '/pre-planned',
        destination: '/discover',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
