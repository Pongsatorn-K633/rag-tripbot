import Link from 'next/link'
import { MessageSquare, Upload, ArrowRight } from 'lucide-react'
import SeigaihaBackdrop from '@/app/components/SeigaihaBackdrop'

// ── Create hub ────────────────────────────────────────────────────────────────
// The single entry point for building a trip. Fans out to the two AI creation
// tools: AI Chat (plan from scratch — under maintenance for now) and AI Scanner
// (upload an existing plan → the VLM turns it into an editable itinerary).

export const metadata = {
  title: 'Create · dopamichi',
  description: 'สร้างแผนการเดินทางของคุณ — แชทกับ AI หรือสแกนแผนเดิม',
}

export default function CreatePage() {
  return (
    // Dark page — ClientLayout paints the Graphite canvas for this route.
    // pt-32 / pb-24 / header mb-16 — /discover's exact vertical rhythm, so the
    // three dark pages sit at the same distance from the navbar and give their
    // content the same breath below the heading.
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto text-briefing-cream">
      <SeigaihaBackdrop />
      {/* Hero — the SAME type scale as /discover's "Ready-to-go Trips"
          (font-headline bold, 3xl→5xl, tracking-tight) with its subtitle
          treatment, so the three dark pages read as one family. */}
      <header className="mb-16">
        <h1 className="font-headline font-bold text-3xl md:text-5xl tracking-tight">
          Create
        </h1>
        <p className="mt-2.5 text-briefing-cream/70 font-sans">
          เริ่มต้นสร้างแผนการเดินทางของคุณ — เลือกวิธีที่ใช่สำหรับคุณ
        </p>
      </header>

      {/* Two pathways — separate glass cards (the app's dark-surface language:
          white/15 hairline over a white/10 fill with blur, Ocean border on
          hover), not one bordered grid with dividers. AI Scanner comes FIRST:
          the chat is under maintenance, so the working tool leads. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* AI Scanner — the live path */}
        <Link
          href="/ai-scanner"
          className="group flex flex-col rounded-3xl border border-white/15 bg-white/10 p-8 backdrop-blur-sm transition-[border-color,background-color,box-shadow] duration-300 hover:border-basel-brick/60 hover:bg-white/[0.14] hover:shadow-[0_0_32px_rgba(91,136,178,0.18)]"
        >
          <Upload className="mb-6 size-9 text-basel-brick" strokeWidth={1.75} />
          <h2 className="font-headline text-2xl font-bold tracking-tight">มีแผนอยู่แล้ว? สแกนเลย</h2>
          <p className="mt-2.5 font-sans text-briefing-cream/70">
            อัปโหลดไฟล์ PDF หรือรูปภาพแผนเดิมของคุณ ให้ AI แปลงเป็นแผนที่แก้ไขได้ พร้อมพากย์ไปเที่ยว
          </p>
          {/* mt-auto pins the CTA to the card's floor so both cards' links line
              up however long the copy runs. Same link vocabulary as "Discover →". */}
          <span className="mt-auto flex items-center gap-1.5 pt-8 font-headline text-xs font-bold tracking-wide text-briefing-cream/80 transition-colors group-hover:text-basel-brick">
            Upload File
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* AI Chat — UNDER MAINTENANCE (points at /maintenance for now). Dimmed
            and flat: no hover bloom, so it reads as unavailable, not just second. */}
        <Link
          href="/maintenance"
          className="group relative flex cursor-not-allowed flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm transition-colors duration-300 hover:border-white/20"
        >
          {/* Pill, like every other status chip in the app (was a square tag). */}
          <span className="absolute right-5 top-5 rounded-full bg-basel-brick/90 px-2.5 py-1 font-headline text-[9px] font-black uppercase tracking-widest text-white">
            Maintenance
          </span>
          <MessageSquare className="mb-6 size-9 text-briefing-cream/35" strokeWidth={1.75} />
          <h2 className="font-headline text-2xl font-bold tracking-tight text-briefing-cream/55">
            แชทวางแผนกับ AI
          </h2>
          <p className="mt-2.5 font-sans text-briefing-cream/45">
            คุยกับ AI Concierge เพื่อสร้างแผนเที่ยวใหม่ตั้งแต่ต้น — ขณะนี้กำลังปรับปรุงอยู่ 🍵
          </p>
          <span className="mt-auto flex items-center gap-1.5 pt-8 font-headline text-xs font-bold tracking-wide text-briefing-cream/45">
            Temporarily Offline
            <ArrowRight className="size-3.5" />
          </span>
        </Link>
      </div>
    </main>
  )
}
