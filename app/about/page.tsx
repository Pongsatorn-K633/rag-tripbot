export const metadata = { title: 'About · dopamichi' }

export default function AboutPage() {
  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="space-y-3 border-b border-zen-black/10 pb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Our Story</p>
          <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
            About dopamichi
          </h1>
          <p className="text-lg font-bold text-zen-black/70">
            ผู้ช่วยวางแผนทริปญี่ปุ่นสำหรับคนไทย 🇹🇭 → 🇯🇵
          </p>
        </div>

        <section className="space-y-6 font-medium text-zen-black/80 leading-relaxed">
          <p className="text-xl font-bold text-zen-black">
            dopamichi = dopamine + michi (道 &quot;path&quot;).
          </p>
          <p>
            เชื่อว่าความสุขของการเที่ยวไม่ได้เริ่มที่สนามบิน แต่เริ่มตั้งแต่วินาทีที่คุณเริ่มวางแผน
            เราจึงสร้าง AI Concierge ที่เข้าใจรสนิยมคนไทย พูดไทยได้ลื่น และช่วยคิดแผนเที่ยวญี่ปุ่นให้คุณได้ในไม่กี่วินาที
          </p>
          <p>
            We believe the joy of travel starts the moment you begin planning — not when you land at the airport.
            dopamichi is an AI concierge that speaks fluent Thai, understands Thai travel tastes, and builds
            Japan itineraries in seconds.
          </p>
        </section>

        <section className="space-y-6 border-t border-zen-black/10 pt-10">
          <h2 className="text-2xl font-headline font-bold text-zen-black">How it works</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border border-zen-black/20 bg-white/40">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">Phase 1 · Plan</p>
              <h3 className="font-headline font-bold text-lg mb-2">Web Concierge</h3>
              <p className="text-sm text-zen-black/70">
                Chat with our Modular RAG assistant to design your itinerary day-by-day.
              </p>
            </div>
            <div className="p-6 border border-zen-black/20 bg-white/40">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">Phase 2 · Travel</p>
              <h3 className="font-headline font-bold text-lg mb-2">LINE Companion</h3>
              <p className="text-sm text-zen-black/70">
                Activate in LINE and ask questions on the go — the bot knows your exact plan.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-zen-black/10 pt-10 space-y-3">
          <h2 className="text-2xl font-headline font-bold text-zen-black">Stack</h2>
          <p className="text-sm text-zen-black/70">
            Next.js · Prisma · Neon PostgreSQL + pgvector · BGE-M3 · Gemini 2.5 Flash · LINE Messaging API
          </p>
        </section>

        <p className="text-[9px] font-bold uppercase tracking-widest text-zen-black/30 pt-8">
          dopamichi · zen edition v.01
        </p>
      </div>
    </main>
  )
}
