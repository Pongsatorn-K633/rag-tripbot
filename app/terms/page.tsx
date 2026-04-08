export const metadata = { title: 'Terms · dopamichi' }

export default function TermsPage() {
  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3 border-b border-zen-black/10 pb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Legal</p>
          <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
            Terms of Service
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-zen-black/50">
            Last updated · 2026-04-08
          </p>
        </div>

        <section className="space-y-4 font-medium text-zen-black/80 leading-relaxed">
          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">1. การใช้งาน · Usage</h2>
          <p>
            dopamichi เป็นผู้ช่วยวางแผนทริปที่ขับเคลื่อนด้วย AI ข้อมูลที่ได้จากระบบเป็นคำแนะนำเพื่อประกอบการตัดสินใจ
            โปรดตรวจสอบเวลา ราคา และสถานะสถานที่ท่องเที่ยวกับแหล่งทางการก่อนเดินทางจริง
          </p>
          <p>
            dopamichi is an AI-powered trip planning assistant. All generated itineraries are suggestions —
            please verify opening hours, pricing, and availability with official sources before you travel.
          </p>

          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">2. No Warranty</h2>
          <p>
            The service is provided &quot;as is.&quot; We don&apos;t guarantee accuracy of AI-generated content, and
            we&apos;re not liable for decisions made based on itineraries produced by the chatbot.
          </p>

          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">3. Acceptable use</h2>
          <p>
            Don&apos;t abuse the service, scrape it, or use it for anything illegal. We may rate-limit or block
            accounts that degrade the experience for others.
          </p>

          <h2 className="text-2xl font-headline font-bold text-zen-black pt-4">4. การเปลี่ยนแปลง · Changes</h2>
          <p>
            เงื่อนไขอาจมีการปรับปรุงตามเวลา กรุณาเช็คหน้านี้เป็นระยะ
          </p>
        </section>
      </div>
    </main>
  )
}
