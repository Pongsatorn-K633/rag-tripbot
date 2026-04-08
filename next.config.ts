import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
    ]
  },
}

export default nextConfig
