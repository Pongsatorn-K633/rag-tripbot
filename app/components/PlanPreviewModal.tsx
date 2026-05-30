'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { ArrowLeft, CalendarDays, CalendarCheck, AlertTriangle } from 'lucide-react'
import 'react-day-picker/style.css'
import ItineraryCard from '@/app/components/ItineraryCard'
import type { PlanTemplate } from '@/app/components/PlanCard'
import { extendItineraryWithFreeDays } from '@/lib/trips/extend'

type SaveState = 'idle' | 'dates' | 'saving' | 'done'

function addDays(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtThai(d: Date): string {
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}
// Inclusive day count between two dates (17→20 Oct = 4 days), midnight-normalized.
function dayCount(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.round((b - a) / 86_400_000) + 1
}

/**
 * Preview + duplicate modal for a pre-planned trip. Self-contained: owns its own
 * save state and posts a Trip copy to /api/trips. Shared by /pre-planned + /saved.
 *
 * Flow: preview → REQUIRED travel-date RANGE step → save + auto-mint code → done.
 * The user picks a start AND end (pre-filled from the page's filter window when
 * present, adjustable either way). The trip must span at least the plan length;
 * any days beyond it become labeled free days. The activation code is shown only
 * in My Trip.
 */
export default function PlanPreviewModal({
  template,
  defaultStartDate = '',
  defaultEndDate = '',
  callbackUrl,
  onClose,
}: {
  template: PlanTemplate | null
  /** Pre-fills the date step's range start if the page already filtered by dates. */
  defaultStartDate?: string
  /** Pre-fills the range end — together they seed the editable travel window. */
  defaultEndDate?: string
  callbackUrl: string
  onClose: () => void
}) {
  const { data: session } = useSession()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [range, setRange] = useState<DateRange | undefined>()

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const tripDays = template?.totalDays ?? template?.itinerary?.days?.length ?? 1

  // Reset + pre-fill whenever a different template is opened. Seed the range from
  // the page's filter window (start → end), padding the end to at least the plan
  // length so the pre-filled range is always valid. No filter ⇒ empty (user picks).
  useEffect(() => {
    if (!template) return
    setSaveState('idle')
    const days = template.totalDays ?? template.itinerary?.days?.length ?? 1
    if (defaultStartDate) {
      const start = new Date(defaultStartDate)
      const win = defaultEndDate ? dayCount(start, new Date(defaultEndDate)) : days
      const length = Math.max(days, win)
      setRange({ from: start, to: addDays(start, length - 1) })
    } else {
      setRange(undefined)
    }
  }, [template, defaultStartDate, defaultEndDate])

  // Derived window state — the trip must span at least the plan length.
  const from = range?.from
  const to = range?.to
  const selectedDays = from && to ? dayCount(from, to) : null
  const complete = !!(from && to)
  const tooShort = complete && (selectedDays as number) < tripDays
  const valid = complete && !tooShort
  const tripLength = valid ? (selectedDays as number) : tripDays
  const freeDays = valid ? tripLength - tripDays : 0

  // Step 1 → 2: from the preview's "Duplicate or Edit" button into the date step.
  function handleStartDuplication() {
    if (!session?.user) {
      signIn(undefined, { callbackUrl })
      return
    }
    setSaveState('dates')
  }

  // Step 2 → save: requires a valid range (start + end, ≥ plan length).
  async function handleConfirm() {
    if (!template || !from || !valid) return
    setSaveState('saving')
    // Pad the plan with free days when the chosen window is longer than the plan.
    const itineraryToSave =
      freeDays > 0 ? extendItineraryWithFreeDays(template.itinerary, tripLength) : template.itinerary
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          itinerary: itineraryToSave,
          source: 'plan',
          templateId: template.id,
          coverImage: template.coverImage ?? undefined,
          startDate: toISODate(from),
        }),
      })
      if (!res.ok) throw new Error('Failed to save template')
      const { trip } = await res.json()

      // Auto-generate a fresh activation code so it's ready to redeem in My Trip
      // (revealed there, not here — now always bound to the chosen travel dates).
      try {
        const primaryCity = template.itinerary?.days?.[0]?.location ?? 'JPN'
        await fetch('/api/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: trip.id, primaryCity }),
        })
      } catch {
        // Non-fatal — the user can still generate the code in My Trip.
      }
      setSaveState('done')
    } catch (err) {
      console.error('Save error:', err)
      setSaveState('dates')
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
  }

  function handleClose() {
    setSaveState('idle')
    onClose()
  }

  return (
    <AnimatePresence>
      {template && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-10 px-2 sm:px-4"
          style={{ backgroundColor: 'rgba(35,26,14,0.75)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget && saveState !== 'saving') handleClose()
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-briefing-cream border border-zen-black/10 shadow-2xl overflow-hidden rounded-xl"
          >
            {/* Top-bar close (same as the My Trip view) */}
            {saveState !== 'saving' && (
              <div className="px-4 sm:px-6 pt-3 flex items-center justify-end">
                <button onClick={handleClose} className="text-zen-black/40 hover:text-zen-black text-2xl leading-none transition-colors" aria-label="ปิด">&times;</button>
              </div>
            )}
            <div className="px-4 sm:px-6 py-5">
              {saveState === 'done' ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-2xl">✓</span>
                  </div>
                  <h3 className="font-headline font-black text-xl text-zen-black">คัดลอกเรียบร้อย!</h3>
                  <p className="text-sm text-zen-black/60">
                    เพิ่มทริปของคุณในหน้า My Trip แล้ว — แก้ไขได้อิสระ และรับรหัส LINE ได้ที่นั่นเลย
                  </p>
                  <div className="flex gap-3 pt-2">
                    <Link
                      href="/my-trip"
                      className="flex-1 py-3 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all text-center"
                    >
                      Go to My Trip
                    </Link>
                    <button
                      onClick={handleClose}
                      className="flex-1 py-3 rounded-lg border-2 border-zen-black font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black hover:text-briefing-cream transition-all"
                    >
                      เลือกแพลนอื่น
                    </button>
                  </div>
                </div>
              ) : saveState === 'dates' || saveState === 'saving' ? (
                <DateStep
                  tripDays={tripDays}
                  tripLength={tripLength}
                  freeDays={freeDays}
                  range={range}
                  complete={complete}
                  tooShort={tooShort}
                  valid={valid}
                  today={today}
                  onChange={setRange}
                  onBack={() => setSaveState('idle')}
                  onConfirm={handleConfirm}
                  saving={saveState === 'saving'}
                />
              ) : (
                <ItineraryCard
                  itinerary={template.itinerary}
                  onConfirm={handleStartDuplication}
                  coverImage={template.coverImage}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Required travel-date range step ─────────────────────────────────────────

function DateStep({
  tripDays,
  tripLength,
  freeDays,
  range,
  complete,
  tooShort,
  valid,
  today,
  onChange,
  onBack,
  onConfirm,
  saving,
}: {
  /** The plan's own length (minimum the range must span). */
  tripDays: number
  /** The length the trip will actually span (= the picked range when valid). */
  tripLength: number
  /** Extra days beyond the plan that become free days (0 when range = plan). */
  freeDays: number
  range: DateRange | undefined
  /** Both ends of the range are set. */
  complete: boolean
  /** Range is set but shorter than the plan. */
  tooShort: boolean
  /** Range is set and ≥ plan length. */
  valid: boolean
  today: Date
  onChange: (r: DateRange | undefined) => void
  onBack: () => void
  onConfirm: () => void
  saving: boolean
}) {
  const from = range?.from
  const to = range?.to
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          disabled={saving}
          className="text-zen-black/40 hover:text-zen-black transition-colors disabled:opacity-40"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <h3 className="font-headline font-black text-xl text-zen-black">เลือกวันเดินทาง</h3>
      </div>
      <p className="text-sm text-zen-black leading-relaxed">
        เลือกช่วงวันเดินทางของคุณ (แผนนี้มี {tripDays} วัน — เลือกได้ยาวกว่าได้)
        สามารถแก้ไขเพิ่มลดจำนวนวันได้ที่ My Trip
      </p>

      <div
        className="rdp-brand flex justify-center border border-zen-black/10 rounded-xl bg-white p-2"
        style={
          {
            '--rdp-accent-color': '#B43325',
            '--rdp-accent-background-color': '#f1e2de',
            '--rdp-today-color': '#B43325',
            '--rdp-range_middle-color': '#231a0e',
          } as React.CSSProperties
        }
      >
        <DayPicker
          mode="range"
          min={1}
          selected={range}
          onSelect={onChange}
          defaultMonth={from ?? today}
          numberOfMonths={1}
          disabled={{ before: today }}
          showOutsideDays
        />
      </div>

      {/* Range summary */}
      {from && (
        <div className="flex items-center justify-center gap-3 text-sm bg-white border border-zen-black/10 rounded-lg px-4 py-3">
          <CalendarDays size={16} className="text-basel-brick" strokeWidth={2.5} />
          <span className="font-semibold text-zen-black">{fmtThai(from)}</span>
          <span className="text-zen-black/30">→</span>
          {to ? (
            <span className="font-semibold text-zen-black">{fmtThai(to)}</span>
          ) : (
            <span className="text-zen-black/40">เลือกวันสิ้นสุด</span>
          )}
          {valid && <span className="text-zen-black/40 text-xs">· {tripLength} วัน</span>}
        </div>
      )}

      {/* Too short for the plan */}
      {tooShort && (
        <div className="flex items-start gap-2.5 text-[13px] leading-relaxed bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <span>
            แผนนี้มี <span className="font-bold">{tripDays} วัน</span> — กรุณาเลือกช่วงให้ครอบคลุมอย่างน้อย {tripDays} วัน
          </span>
        </div>
      )}

      {/* Free days appended */}
      {valid && freeDays > 0 && (
        <div className="flex items-start gap-2.5 text-[13px] leading-relaxed bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-900">
          <CalendarCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <span>
            ช่วงวันที่คุณเลือกยาวกว่าแผนสำเร็จรูป {tripDays} วัน อยู่{' '}
            <span className="font-bold">{freeDays} วัน</span> — ระบบจะเพิ่ม
            <span className="font-bold"> {freeDays} วันอิสระ</span> ต่อท้ายให้ คุณวางแผนเองได้ที่ My Trip
          </span>
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={!valid || saving}
        className="w-full py-4 rounded-lg bg-basel-brick text-white font-headline font-black text-xs uppercase tracking-[0.2em] hover:bg-zen-black transition-all disabled:opacity-50"
      >
        {saving ? 'กำลังคัดลอก...' : 'ยืนยันและคัดลอกไปยัง My Trip'}
      </button>
      {!valid && !tooShort && (
        <p className="text-[12px] text-zen-black text-center -mt-2">
          {complete ? 'กรุณาเลือกช่วงวันเดินทาง' : from ? 'เลือกวันสิ้นสุดของการเดินทาง · Pick an end date' : 'เลือกช่วงวันเดินทางก่อน · Pick your travel dates'}
        </p>
      )}
    </div>
  )
}
