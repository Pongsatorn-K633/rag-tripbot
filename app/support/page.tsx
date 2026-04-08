import { Mail, MessageCircle, HelpCircle } from 'lucide-react'

export const metadata = { title: 'Support · dopamichi' }

export default function SupportPage() {
  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="space-y-3 border-b border-zen-black/10 pb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Help Desk</p>
          <h1 className="text-5xl md:text-6xl font-black font-headline tracking-tighter text-zen-black italic">
            Support
          </h1>
          <p className="text-lg font-bold text-zen-black/70">
            มีปัญหา? เราพร้อมช่วย · Something broken? We&apos;re here to help.
          </p>
        </div>

        <section className="grid md:grid-cols-3 gap-0 border border-zen-black">
          <div className="p-8 border-b md:border-b-0 md:border-r border-zen-black">
            <Mail className="w-8 h-8 mb-4 text-basel-brick" strokeWidth={1.5} />
            <h3 className="font-headline font-bold text-xl mb-2">Email</h3>
            <p className="text-sm text-zen-black/60 mb-3">For detailed issues</p>
            <a className="text-basel-brick font-bold text-sm underline" href="mailto:dopamichi.info@gmail.com">
              support@dopamichi.com
            </a>
          </div>
          <div className="p-8 border-b md:border-b-0 md:border-r border-zen-black">
            <MessageCircle className="w-8 h-8 mb-4 text-basel-brick" strokeWidth={1.5} />
            <h3 className="font-headline font-bold text-xl mb-2">LINE</h3>
            <p className="text-sm text-zen-black/60 mb-3">แชทกับบอทของเรา</p>
            <span className="text-zen-black font-bold text-sm">@638xbyfd</span>
          </div>
          <div className="p-8">
            <HelpCircle className="w-8 h-8 mb-4 text-basel-brick" strokeWidth={1.5} />
            <h3 className="font-headline font-bold text-xl mb-2">FAQ</h3>
            <p className="text-sm text-zen-black/60 mb-3">Common questions</p>
            <span className="text-zen-black/40 font-bold text-sm uppercase tracking-widest">Coming soon</span>
          </div>
        </section>

        <section className="space-y-4 font-medium text-zen-black/80 leading-relaxed">
          <h2 className="text-2xl font-headline font-bold text-zen-black">คำถามที่พบบ่อย</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-zen-black">AI Chat ใช้งานไม่ได้?</h3>
              <p className="text-sm">ขณะนี้ /chat อยู่ในช่วงปรับปรุง กลับมาเร็วๆ นี้ ลองเลือกจาก Templates ไปก่อนได้เลยค่ะ</p>
            </div>
            <div>
              <h3 className="font-bold text-zen-black">How do I activate my trip in LINE?</h3>
              <p className="text-sm">
                After saving a trip, copy the share code and type <code>/activate TKY-XXX</code> in our LINE chat.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
