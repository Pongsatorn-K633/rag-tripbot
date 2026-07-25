import Link from 'next/link'
import { MessageSquare, Upload, ArrowRight } from 'lucide-react'

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
    <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto text-briefing-cream">
      {/* Hero */}
      <header className="mb-16">
        <h1 className="text-4xl md:text-5xl lg:text-7xl font-headline font-extrabold tracking-tighter text-briefing-cream mb-6">
          Create
        </h1>
        <p className="text-briefing-cream/70 text-lg max-w-2xl leading-relaxed font-sans">
          เริ่มต้นสร้างแผนการเดินทางของคุณ — เลือกวิธีที่ใช่สำหรับคุณ
        </p>
      </header>

      {/* Two pathways */}
      <div className="grid grid-cols-1 md:grid-cols-2 border border-white/15">
        {/* AI Chat — UNDER MAINTENANCE (points at /maintenance for now) */}
        <Link
          href="/maintenance"
          className="group relative p-12 border-b md:border-b-0 md:border-r border-white/15 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 cursor-not-allowed"
        >
          <div className="absolute top-4 right-4 bg-basel-brick text-white text-[9px] font-black uppercase tracking-widest px-2 py-1">
            Maintenance
          </div>
          <MessageSquare className="w-10 h-10 mb-8 text-briefing-cream opacity-40" strokeWidth={1.5} />
          <h3 className="text-3xl font-headline font-bold mb-6 text-briefing-cream opacity-55">แชทวางแผนกับ AI</h3>
          <p className="mb-10 text-lg text-briefing-cream/50">
            คุยกับ AI Concierge เพื่อสร้างแผนเที่ยวใหม่ตั้งแต่ต้น — ขณะนี้กำลังปรับปรุงอยู่ 🍵
          </p>
          <div className="flex items-center font-bold uppercase tracking-widest text-sm text-briefing-cream/50">
            <span>Temporarily Offline</span>
            <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </Link>

        {/* AI Scanner — upload an existing plan */}
        <Link
          href="/ai-scanner"
          className="group p-12 text-briefing-cream hover:bg-basel-brick hover:text-briefing-cream transition-all duration-300 cursor-pointer"
        >
          <Upload className="w-10 h-10 mb-8" strokeWidth={1.5} />
          <h3 className="text-3xl font-headline font-bold mb-6">มีแผนอยู่แล้ว? สแกนเลย</h3>
          <p className="mb-10 text-lg opacity-80">
            อัปโหลดไฟล์ PDF หรือรูปภาพแผนเดิมของคุณ ให้ AI แปลงเป็นแผนที่แก้ไขได้ พร้อมพากย์ไปเที่ยว
          </p>
          <div className="flex items-center font-bold uppercase tracking-widest text-sm">
            <span>Upload File</span>
            <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </Link>
      </div>
    </main>
  )
}
