'use client'

import Link from 'next/link'
import { ArrowLeft, Wrench } from 'lucide-react'

// Playful bilingual maintenance screen for routes that are temporarily offline.
// Currently used by /chat while the RAG pipeline is being tuned.
// See docs/architecture.md and next.config.ts for the active redirect.

export default function MaintenancePage() {
  return (
    <main className="pt-[84px] min-h-screen flex items-center justify-center bg-briefing-cream px-8">
      <div className="max-w-2xl w-full text-center space-y-10">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-basel-brick text-white rounded-full flex items-center justify-center animate-pulse">
            <Wrench size={32} strokeWidth={2} />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">
            Status · Under Maintenance
          </p>
          <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
            Concierge is napping 🍵
          </h1>
          <p className="text-lg font-bold text-zen-black/70">
            เจ้า AI ของเรากำลังงีบอยู่ที่เกียวโต เดี๋ยวตื่นมาจะรีบมาช่วยวางแผนให้นะคะ ✨
          </p>
          <p className="text-sm font-medium text-zen-black/60">
            Our AI concierge is sipping matcha and tuning her itinerary brain. <br />
            She&apos;ll be back to plan your Japan adventure very soon.
          </p>
        </div>

        <div className="border-t border-zen-black/10 pt-8 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zen-black/40">
            In the meantime · ระหว่างนี้
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/templates"
              className="px-6 py-3 bg-zen-black text-briefing-cream font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-basel-brick transition-all"
            >
              Browse Templates · แพ็คเกจสำเร็จรูป
            </Link>
            <Link
              href="/"
              className="px-6 py-3 border-2 border-zen-black text-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={14} strokeWidth={3} />
              Back Home
            </Link>
          </div>
        </div>

        <p className="text-[9px] font-bold uppercase tracking-widest text-zen-black/30">
          dopamichi · zen edition v.01
        </p>
      </div>
    </main>
  )
}
