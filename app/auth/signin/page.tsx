'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/'

  async function handleGoogle() {
    setLoading('google')
    await signIn('google', { callbackUrl })
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading('resend')
    await signIn('resend', { email, callbackUrl })
  }

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8 flex items-center">
      <div className="max-w-md w-full mx-auto space-y-10">
        <div className="text-center space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">Welcome</p>
          <h1 className="text-5xl font-black font-headline tracking-tighter text-zen-black italic">
            Sign in
          </h1>
          <p className="text-sm font-medium text-zen-black/60">
            เข้าสู่ระบบเพื่อบันทึกทริปและปลดล็อกฟีเจอร์สมาชิก
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading !== null}
          className="w-full py-4 border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all disabled:opacity-40 flex items-center justify-center gap-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
          </svg>
          {loading === 'google' ? 'Signing in…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-zen-black/10" />
          <span className="text-[9px] font-black uppercase tracking-widest text-zen-black/40">or</span>
          <div className="flex-1 h-px bg-zen-black/10" />
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">
              Email address
            </label>
            <div className="flex items-center border-b-2 border-zen-black py-2 focus-within:border-basel-brick">
              <Mail size={16} className="text-zen-black/40 mr-2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading !== null}
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm font-medium text-zen-black placeholder:text-zen-black/30"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading !== null || !email}
            className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40"
          >
            {loading === 'resend' ? 'Sending link…' : 'Send me the email'}
          </button>
        </form>

        <p className="text-center text-[9px] font-bold uppercase tracking-widest text-zen-black/30">
          dopamichi · zen edition v.01
        </p>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
