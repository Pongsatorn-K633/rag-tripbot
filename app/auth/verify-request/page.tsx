import { Mail } from 'lucide-react'

export const metadata = { title: 'Check your email · dopamichi' }

export default function VerifyRequestPage() {
  return (
    <main className="pt-[120px] pb-24 min-h-screen flex items-center justify-center bg-briefing-cream px-8">
      <div className="max-w-md text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-basel-brick text-white rounded-full flex items-center justify-center">
            <Mail size={32} strokeWidth={2} />
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">
            Magic link sent
          </p>
          <h1 className="text-4xl font-black font-headline tracking-tighter text-zen-black italic">
            Check your email ✉️
          </h1>
          <p className="text-sm font-medium text-zen-black/70">
            เราส่งลิงก์เข้าสู่ระบบไปที่อีเมลของคุณแล้ว กรุณากดลิงก์ในอีเมลเพื่อเข้าสู่ระบบ
          </p>
          <p className="text-xs text-zen-black/50">
            We sent you a sign-in link. Click the link in your email to continue. <br />
            The link expires in 5 minutes.
          </p>
        </div>
      </div>
    </main>
  )
}
