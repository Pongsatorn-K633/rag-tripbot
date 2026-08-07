'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Check } from 'lucide-react'
import ProfilePictureUpload from '@/app/components/ProfilePictureUpload'
import SeigaihaBackdrop from '@/app/components/SeigaihaBackdrop'

/**
 * /settings — account profile.
 *
 * Dark canvas like the rest of the signed-in app ('/settings' is in
 * GRAPHITE_ROUTES), with the form itself on a WHITE card: dense field UI reads
 * badly on graphite, and this is the same split the AI Scanner review step uses.
 */
export default function SettingsPage() {
  return (
    // max-w-2xl, not the browse pages' max-w-7xl: a single-column form has no
    // business spanning the page. pt-32 / pb-24 still match them.
    <main className="pt-32 pb-24 px-4 sm:px-6 max-w-2xl mx-auto text-briefing-cream">
      <SeigaihaBackdrop />

      <header className="mb-10">
        {/* Title row — Back rides on the TITLE's line, right-aligned, the same
            slot /my-trips ("Discover →") and /ai-scanner ("Create →") use. The
            arrow leads here because this one goes back, not onward. */}
        {/* The dark pages' shared title treatment (was a 5xl black italic
            "Settings · ตั้งค่า"): headline bold, 3xl→5xl, Thai subtitle under. */}
        <div className="flex items-center gap-4">
          <h1 className="font-headline font-bold text-3xl md:text-5xl tracking-tight">
            Settings
          </h1>
          <Link
            href="/"
            // translate-y: nudged down off the title's optical centre so it
            // sits nearer the type's baseline than its cap height.
            className="group ml-auto mr-3 flex shrink-0 translate-y-1.5 items-center gap-1.5 font-headline text-xs font-bold tracking-wide text-briefing-cream/80 transition-colors hover:text-basel-brick"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
            Back
          </Link>
        </div>
        <p className="mt-2.5 text-briefing-cream/70 font-sans">
          ตั้งค่าโปรไฟล์ของคุณ — ชื่อที่แสดงและรูปประจำตัว
        </p>
      </header>

      {/* Account settings (theme toggle removed — single palette) */}
      <AccountTab />
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
    return (
      <div className="rounded-3xl bg-white p-6 font-detail shadow-lg sm:p-8">
        <p className="py-8 text-center text-[13px] text-graphite/60">Loading...</p>
      </div>
    )
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
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-3xl bg-white p-6 font-detail shadow-lg sm:p-8"
    >
      {/* Profile picture with crop — on its own cream panel so the avatar and
          its three actions read as one segment instead of floating loose above
          the fields. Same cream fill as the read-only email row below. */}
      <div className="rounded-2xl bg-briefing-cream p-5">
        <ProfilePictureUpload value={image} onChange={setImage} disabled={saving} />
      </div>

      {/* Display name — the trip modal's field vocabulary: 11px Ocean label,
          rounded-xl bordered input (was a 10px 0.3em label over a bare
          border-b-2 underline). */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-basel-brick">
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
          className="w-full rounded-xl border border-zen-black/15 bg-white px-4 py-2.5 text-sm font-medium text-zen-black transition-colors placeholder:text-graphite/40 focus:border-basel-brick focus:outline-none disabled:opacity-40"
        />
      </div>

      {/* Email (read-only) — cream fill says "not editable" without a disabled
          input's greyed-out ambiguity. */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-graphite/60">
          Email (read-only)
        </label>
        <p className="rounded-xl bg-briefing-cream px-4 py-2.5 text-sm font-medium text-graphite/70">
          {session.user.email}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-[12px] leading-relaxed text-red-800">
          <span className="mt-px font-bold">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Ocean, not green: the palette carries one accent, and the check glyph
          already says "done" without a second hue. */}
      {success && (
        <div className="flex items-center gap-2 rounded-2xl bg-basel-brick/10 px-3.5 py-3 text-[12px] font-semibold leading-relaxed text-basel-brick">
          <Check size={14} strokeWidth={3} />
          บันทึกเรียบร้อย · Saved successfully
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-full bg-zen-black py-3.5 text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? 'กำลังบันทึก... · Saving...' : 'บันทึก · Save Changes'}
      </button>
    </form>
  )
}
