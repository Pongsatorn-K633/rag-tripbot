export const metadata = { title: 'Privacy · dopamichi' }

export default function PrivacyPage() {
  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3 border-b border-zen-black/10 pb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Legal</p>
          <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
            Privacy Policy
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-zen-black/50">
            Last updated · 2026-04-08
          </p>
        </div>

        <section className="space-y-4 font-medium text-zen-black/80 leading-relaxed">
          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">1. ข้อมูลที่เราเก็บ</h2>
          <p>
            dopamichi เก็บข้อมูลเท่าที่จำเป็นเพื่อวางแผนทริปญี่ปุ่นให้คุณ ได้แก่ คำถามที่ส่งเข้ามาใน AI Concierge,
            แผนการเดินทางที่บันทึกไว้, และ LINE User ID (เฉพาะเมื่อคุณ /activate)
          </p>

          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">2. What we collect</h2>
          <p>
            We collect only what&apos;s needed to plan your Japan trip: chat messages sent to our AI Concierge,
            saved itineraries, and your LINE user ID (only when you run the <code>/activate</code> command).
          </p>

          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">3. How we use it</h2>
          <p>
            Your data powers itinerary generation and the LINE context-injection bot. We do not sell data to third
            parties. Chat content may be sent to Google Gemini for processing under their privacy terms.
          </p>

          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">4. ติดต่อเรา · Contact</h2>
          <p>
            มีคำถามเรื่องข้อมูลส่วนตัว? ส่งมาที่ <a className="text-basel-brick underline" href="/support">Support</a>.
          </p>
        </section>
      </div>
    </main>
  )
}
