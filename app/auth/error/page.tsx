'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AlertTriangle } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'มีปัญหาการตั้งค่าเซิร์ฟเวอร์ · Server configuration error',
  AccessDenied: 'คุณไม่มีสิทธิ์เข้าถึง · Access denied',
  Verification: 'ลิงก์หมดอายุหรือใช้ไปแล้ว · Link expired or already used',
  Default: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง · Something went wrong',
}

function ErrorContent() {
  const error = useSearchParams().get('error') ?? 'Default'
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default

  return (
    <main className="pt-[120px] pb-24 min-h-screen flex items-center justify-center bg-briefing-cream px-8">
      <div className="max-w-md text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-basel-brick text-white rounded-full flex items-center justify-center">
            <AlertTriangle size={32} strokeWidth={2} />
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">
            Authentication error
          </p>
          <h1 className="text-4xl font-black font-headline tracking-tighter text-zen-black italic">
            Oops
          </h1>
          <p className="text-sm font-medium text-zen-black/70">{message}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zen-black/30">
            Error code: {error}
          </p>
        </div>
        <Link
          href="/auth/signin"
          className="inline-block px-6 py-3 bg-zen-black text-briefing-cream font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-basel-brick transition-all"
        >
          Try again
        </Link>
      </div>
    </main>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
