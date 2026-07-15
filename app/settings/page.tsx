'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Check } from 'lucide-react'
import ProfilePictureUpload from '@/app/components/ProfilePictureUpload'

export default function SettingsPage() {
  return (
    <main className="pt-[120px] pb-24 min-h-screen bg-briefing-cream px-8">
      <div className="max-w-lg mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zen-black/60 hover:text-basel-brick transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={3} />
            Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-zen-black italic">
            Settings · ตั้งค่า
          </h1>
        </div>

        {/* Account settings (theme toggle removed — single palette) */}
        <AccountTab />
      </div>
    </main>
  )
}

// ── Account Tab ──────────────────────────────────────────────────────────────

function AccountTab() {
  const { data: session, update } = useSession()

  const [name, setName] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? '')
      setImage(session.user.image ?? null)
    }
  }, [session])

  if (!session?.user) {
    return <p className="text-zen-black/40 text-sm py-8">Loading...</p>
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('กรุณากรอกชื่อ · Name is required')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/auth/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), image }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Save failed')
      }

      await update({ name: name.trim(), image: image || '' })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Profile picture with crop */}
      <ProfilePictureUpload
        value={image}
        onChange={setImage}
        disabled={saving}
      />

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
          maxLength={10}
          disabled={saving}
          className="w-full bg-transparent border-b-2 border-zen-black py-3 font-medium text-lg focus:outline-none focus:border-basel-brick transition-colors disabled:opacity-40 placeholder:text-zen-black/30"
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-zen-black/40 mb-2">
          Email (read-only)
        </label>
        <p className="py-3 text-lg font-medium text-zen-black/50 border-b-2 border-zen-black/10">
          {session.user.email}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs">
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="p-3 bg-green-50 border-l-4 border-green-500 text-green-800 text-xs flex items-center gap-2">
          <Check size={14} strokeWidth={3} />
          บันทึกเรียบร้อย · Saved successfully
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full py-4 bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? 'กำลังบันทึก... · Saving...' : 'บันทึก · Save Changes'}
      </button>
    </form>
  )
}
