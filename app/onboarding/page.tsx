'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ProfilePictureUpload from '@/app/components/ProfilePictureUpload'

export default function OnboardingPage() {
  const { data: session, update } = useSession()
  const router = useRouter()

  const [name, setName] = useState(session?.user?.name ?? '')
  const [image, setImage] = useState<string | null>(session?.user?.image ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('กรุณากรอกชื่อ · Please enter your name')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          image: image || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Save failed')
      }

      // Refresh the JWT so middleware sees isOnboarded=true and stops
      // redirecting. Also updates the navbar name + image immediately.
      await update({
        isOnboarded: true,
        name: name.trim(),
        image: image || '',
      })

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8 flex items-center">
      <div className="max-w-md w-full mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-basel-brick">
            Welcome to dopamichi
          </p>
          <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-zen-black italic">
            ตั้งค่าโปรไฟล์
          </h1>
          <p className="text-sm font-medium text-zen-black/60">
            Set up your profile to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile picture with crop */}
          <ProfilePictureUpload
            value={image}
            onChange={setImage}
            disabled={saving}
          />
          {/* <p className="text-[10px] text-zen-black/40 text-center -mt-7">
            Optional — you can skip and use the default avatar <br />
          </p> */}

          {/* Display name */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-2">
              Display Name · ชื่อที่แสดง
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Username"
              required
              maxLength={50}
              disabled={saving}
              className="w-full bg-transparent border-b-2 border-zen-black py-3 font-medium text-lg focus:outline-none focus:border-basel-brick transition-colors disabled:opacity-40 placeholder:text-zen-black/30"
            />
            <p className="text-[10px] text-zen-black/40 mt-2">
              ชื่อนี้จะแสดงใน Navbar และหน้าแอดมิน · This name will be shown across the app
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'กำลังบันทึก... · Saving...' : 'เริ่มต้นใช้งาน · Get Started'}
          </button>
        </form>

        <p className="text-center text-[9px] font-bold uppercase tracking-widest text-zen-black/30">
          dopamichi · zen edition v.01
        </p>
      </div>
    </main>
  )
}
