'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Check, Sun, Moon, Monitor } from 'lucide-react'
import ProfilePictureUpload from '@/app/components/ProfilePictureUpload'
import { useTheme } from '@/app/components/ThemeProvider'

type Tab = 'general' | 'account'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general')

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

        {/* Tabs */}
        <div className="flex gap-0 border-b-2 border-zen-black/10">
          <TabButton active={tab === 'general'} onClick={() => setTab('general')}>
            General
          </TabButton>
          <TabButton active={tab === 'account'} onClick={() => setTab('account')}>
            Account
          </TabButton>
        </div>

        {/* Tab content */}
        {tab === 'general' ? <GeneralTab /> : <AccountTab />}
      </div>
    </main>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 text-xs font-black font-headline uppercase tracking-[0.2em] transition-all border-b-4 -mb-[2px] ${
        active
          ? 'text-basel-brick border-basel-brick'
          : 'text-zen-black/40 border-transparent hover:text-zen-black'
      }`}
    >
      {children}
    </button>
  )
}

// ── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab() {
  const { theme, setTheme } = useTheme()

  const options: Array<{ value: 'light' | 'dark'; label: string; labelTh: string; icon: React.ReactNode }> = [
    {
      value: 'light',
      label: 'Light',
      labelTh: 'สว่าง',
      icon: <Sun size={20} strokeWidth={2} />,
    },
    {
      value: 'dark',
      label: 'Dark',
      labelTh: 'มืด',
      icon: <Moon size={20} strokeWidth={2} />,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Theme */}
      <div>
        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-basel-brick mb-4">
          Theme · ธีม
        </label>
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex items-center gap-3 p-4 border-2 transition-all ${
                theme === opt.value
                  ? 'border-basel-brick bg-basel-brick/5'
                  : 'border-zen-black/10 hover:border-zen-black/30'
              }`}
            >
              <div
                className={`${
                  theme === opt.value ? 'text-basel-brick' : 'text-zen-black/40'
                }`}
              >
                {opt.icon}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-zen-black">{opt.label}</p>
                <p className="text-[10px] text-zen-black/50">{opt.labelTh}</p>
              </div>
              {theme === opt.value && (
                <Check size={16} className="ml-auto text-basel-brick" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zen-black/40 mt-3">
          การตั้งค่าธีมจะถูกบันทึกในเบราว์เซอร์ของคุณ · Theme preference is saved in your browser
        </p>
      </div>
    </div>
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
          maxLength={50}
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
