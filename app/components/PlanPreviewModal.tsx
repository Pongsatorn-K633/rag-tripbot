'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import { DayPicker, type DateRange } from 'react-day-picker'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowLeft, CalendarDays, CalendarCheck, AlertTriangle, Plane, ChevronLeft, Share2, Check, Copy } from 'lucide-react'
import 'react-day-picker/style.css'
import Image from 'next/image'
import { OverviewPanel, ItineraryPanel, DayChips, type DaySel } from '@/app/components/TripPreviewPanels'
import type { PlanTemplate } from '@/app/components/PlanCard'
import { resolveHeroCoverImage } from '@/lib/cover-image'
import type { TripFlight } from '@/lib/itinerary-types'
import { extendItineraryWithFreeDays } from '@/lib/trips/extend'
import { AIRPORTS, getRenderDays, isV3, arrivalTooLate, departureTooTight, departureIsAfter, lastActivityEndTime } from '@/lib/trips/itinerary-model'

/** Whole-hour options (24h, no AM/PM): 00:00 … 23:00. */
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

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
 * save state and posts a Trip copy to /api/trips. Shared by /discover + /saved.
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
  viewOnly = false,
  onClose,
}: {
  template: PlanTemplate | null
  /** Pre-fills the date step's range start if the page already filtered by dates. */
  defaultStartDate?: string
  /** Pre-fills the range end — together they seed the editable travel window. */
  defaultEndDate?: string
  callbackUrl: string
  /** Read-only preview — hides the Duplicate-or-Edit flow (e.g. admin dashboard). */
  viewOnly?: boolean
  onClose: () => void
}) {
  const { data: session } = useSession()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [range, setRange] = useState<DateRange | undefined>()
  const [flight, setFlight] = useState<TripFlight>({})
  // Fullscreen preview chrome: Overview | Itinerary tab + share-code copy tick.
  const [tab, setTab] = useState<'overview' | 'itinerary'>('overview')
  const [selDay, setSelDay] = useState<DaySel>('all')
  const [copied, setCopied] = useState(false)
  // Hero cover carousel (embla) — swipe through Template.coverImages.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [coverIdx, setCoverIdx] = useState(0)
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setCoverIdx(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const tripDays = template?.totalDays ?? template?.itinerary?.days?.length ?? 1
  // Per-cover place names (overview.cover_places, same order as the gallery).
  const coverPlaces =
    template && isV3(template.itinerary) ? (template.itinerary.overview.cover_places ?? []) : []

  // The plan's Day-1 first scheduled time — to warn if the flight lands after it.
  const dayOneFirstTime = useMemo(
    () => (template?.itinerary ? getRenderDays(template.itinerary)[0]?.activities.find((a) => a.time)?.time : undefined),
    [template],
  )
  // The last day's last activity END time — to warn if departure is too tight.
  const lastDayLastTime = useMemo(() => {
    if (!template?.itinerary) return undefined
    const days = getRenderDays(template.itinerary)
    return lastActivityEndTime(days[days.length - 1]?.activities ?? [])
  }, [template])

  // Reset + pre-fill whenever a different template is opened. Seed the range from
  // the page's filter window (start → end), padding the end to at least the plan
  // length so the pre-filled range is always valid. No filter ⇒ empty (user picks).
  useEffect(() => {
    if (!template) return
    setSaveState('idle')
    setFlight({})
    setTab('overview')
    setSelDay('all')
    setCopied(false)
    // (the embla carousel itself remounts with the modal tree, so it always
    // reopens on slide 0 — only our dot index needs resetting)
    setCoverIdx(0)
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
    // Attach the traveler's flights (arrival → Day 1, departure → last day).
    const hasFlight = !!(flight.arrival?.airport || flight.arrival?.time || flight.departure?.airport || flight.departure?.time)
    const itineraryFinal = hasFlight ? { ...itineraryToSave, flight } : itineraryToSave
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          itinerary: itineraryFinal,
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
      // Prefix from the template's PROVINCE (e.g. HOK from HOK-001), not the first
      // city (Sapporo→SAP), so the personal code matches the plan's province.
      try {
        const prefix = template.shareCode?.split('-')[0] || template.itinerary?.days?.[0]?.location || 'JPN'
        await fetch('/api/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: trip.id, primaryCity: prefix }),
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

  function handleShare() {
    if (!template?.shareCode) return
    // Shareable LINK to this trip — /discover opens the preview from ?trip=.
    const url = `${window.location.origin}/discover?trip=${template.shareCode}`
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <AnimatePresence>
      {template && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          // z-[70]: must cover the fixed navbar (z-50) AND the mobile morph
          // button (z-[60]) — a fullscreen takeover, not a dialog.
          className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-briefing-cream"
        >
          {/* ── Hero header — cover photo, back/share chips, period + title ──
              STATIC frame, not full-bleed: a centered column (same max-w-2xl as
              the content) at 4:3. The image keeps the card's 4:5 framing and
              the frame crops the BOTTOM (object-top) — the full-bleed version
              had to zoom the cover to fill wide desktops, which pixelated it. */}
          <div className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden sm:rounded-b-3xl">
            {/* Swipeable cover gallery (Template.coverImages, max 5).
                unoptimized: Cloudinary already crops/sizes/encodes (w_1600,
                f_auto, q_auto) — the Next optimizer's second re-encode was
                half the pixelation. */}
            <div className="absolute inset-0 overflow-hidden" ref={emblaRef}>
              <div className="flex h-full">
                {(template.coverImages?.length ? template.coverImages : [template.coverImage]).map((c, i) => (
                  <div key={i} className="relative h-full flex-[0_0_100%]">
                    <Image
                      src={resolveHeroCoverImage(c, template.id)}
                      alt={`${template.title} ${i + 1}`}
                      fill
                      priority={i === 0}
                      unoptimized
                      className="object-cover object-center"
                      sizes="(max-width: 672px) 100vw, 672px"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Legibility gradient: a light Midnight cap up top (keeps the dots
                and chips readable on bright skies) and a CLOUD fade at the
                bottom — the photo dissolves into the page background and the
                dark title sits on the light scrim. pointer-events-none so
                swipes fall through to the carousel underneath. */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  // Solid Cloud from 96%, NOT 100%: at exactly 100% the final
                  // rendered row is a hair short of opaque, and the photo tints
                  // it — a 1px line across the page right behind the tab pill.
                  'linear-gradient(180deg, rgba(18,44,79,0.35) 0%, rgba(18,44,79,0) 30%, rgba(247,249,252,0) 55%, rgba(247,249,252,0.9) 85%, #F7F9FC 96%)',
              }}
            />

            {/* Cover dots + current photo's place (no per-image place data in
                the admin schema yet — XX until that exists) */}
            {(template.coverImages?.length ?? 0) > 1 && (
              <div className="pointer-events-none absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-1.5">
                {template.coverImages!.map((_, i) => (
                  <span
                    key={i}
                    className={`rounded-full transition-all duration-200 ${
                      i === coverIdx ? 'h-2 w-2 bg-briefing-cream' : 'h-1.5 w-1.5 bg-briefing-cream/50'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Top controls: back (closes; steps back from the date step) + share */}
            <div className="absolute inset-x-4 top-4 flex items-center justify-between sm:inset-x-6">
              <button
                onClick={() => (saveState === 'dates' ? setSaveState('idle') : handleClose())}
                disabled={saveState === 'saving'}
                aria-label="กลับ"
                className="grid h-10 w-10 place-items-center rounded-full bg-zen-black/45 text-briefing-cream backdrop-blur-sm transition-colors hover:bg-zen-black/70 disabled:opacity-50"
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
              {template.shareCode && (
                <span className="relative">
                  {/* Copied indicator — slides in beside the button */}
                  <AnimatePresence>
                    {copied && (
                      <motion.span
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute right-12 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-zen-black/70 px-3 py-1.5 font-headline text-[11px] font-bold text-briefing-cream backdrop-blur-sm"
                      >
                        คัดลอกลิงก์แล้ว
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={handleShare}
                    aria-label="คัดลอกลิงก์ทริป"
                    className="grid h-10 w-10 place-items-center rounded-full bg-zen-black/45 text-briefing-cream backdrop-blur-sm transition-colors hover:bg-zen-black/70"
                  >
                    {copied ? <Check size={18} strokeWidth={2.5} /> : <Share2 size={18} strokeWidth={2.5} />}
                  </button>
                </span>
              )}
            </div>

            {/* Period chip + title — bottom-left, clear of the tab-card overlap.
                pointer-events-none: overlay text must not block cover swipes. */}
            <div className="pointer-events-none absolute inset-x-4 bottom-12 sm:inset-x-0 sm:mx-auto sm:max-w-2xl sm:px-4">
              {/* Current cover photo's PLACE — overview.cover_places keyed to
                  the swipe index; XX for covers without an authored place. */}
              <span className="inline-block rounded-full bg-zen-black/55 px-3 py-1.5 font-headline text-[11px] font-bold tracking-wide text-briefing-cream backdrop-blur-sm">
                {coverPlaces[coverIdx] || 'XX'}
              </span>
              <h1 className="mt-2 font-headline text-3xl font-extrabold leading-tight tracking-tight text-zen-black sm:text-4xl">
                {template.title}
              </h1>
            </div>
          </div>

          {saveState === 'idle' ? (
            <>
              {/* Tab block — floats across the hero/content seam (Kimi TripTabs):
                  segmented capsule + the day chips when Itinerary is active */}
              <div className="relative z-10 -mt-7 px-4 font-detail">
                {/* Seam cover — the hero's compositing-layer edge (overflow-hidden
                    + radius) antialiases as a faint 1px line at fractional DPI
                    zoom, even though both sides are the same cream. This flat
                    strip paints straight over the boundary; the hero's bottom
                    is already solid Cloud there, so it changes nothing else. */}
                <span aria-hidden className="absolute inset-x-0 top-5 h-4 bg-briefing-cream" />
                {/* relative: positioned so it stacks ABOVE the seam strip — an
                    absolute sibling otherwise paints over static content. */}
                <div className="relative mx-auto max-w-2xl">
                  <div className="relative grid grid-cols-2 rounded-full border border-zen-black/10 bg-white p-1 shadow-lg shadow-zen-black/15">
                    {/* Sliding Ocean highlight — ONE persistent element moved by
                        pure TRANSFORM (x 0%↔100%), never layoutId: measured
                        layout animation mis-fires when the tab swap clamps the
                        scroll in the same commit (deep-scroll day-tap), sending
                        the pill across the screen. A transform between two
                        fixed slots cannot be affected by scroll or content. */}
                    <motion.span
                      aria-hidden
                      initial={false}
                      animate={{ x: tab === 'itinerary' ? '100%' : '0%' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-zen-black shadow-md shadow-zen-black/25"
                    />
                    {(['overview', 'itinerary'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={`relative rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
                          tab === key ? 'text-white' : 'text-graphite hover:text-zen-black'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  {tab === 'itinerary' && <DayChips count={tripDays} sel={selDay} onSel={setSelDay} />}
                </div>
              </div>

              {/* Tab content — Kimi-style summary/highlights + day timelines */}
              <div className={`mx-auto max-w-2xl px-4 pt-6 ${viewOnly ? 'pb-16' : 'pb-32'}`}>
                {tab === 'overview' ? (
                  <OverviewPanel
                    itinerary={template.itinerary}
                    tripDays={tripDays}
                    // Tap a highlight row → that day, in the Itinerary tab.
                    // (No scroll reset — layoutScroll on the shell keeps the
                    // pill's slide correct regardless of scroll position.)
                    onDayTap={(day) => {
                      setSelDay(day)
                      setTab('itinerary')
                    }}
                  />
                ) : (
                  <ItineraryPanel itinerary={template.itinerary} sel={selDay} />
                )}
              </div>

              {/* Sticky bottom CTA — entry to the duplicate flow */}
              {!viewOnly && (
                <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zen-black/10 bg-briefing-cream/90 p-4 backdrop-blur">
                  <button
                    onClick={handleStartDuplication}
                    // Styled like the active Overview tab pill (font-detail,
                    // semibold, Ocean glow) so the CTA speaks the same language.
                    className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-full bg-zen-black py-3.5 font-detail text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick"
                  >
                    <Copy size={15} strokeWidth={2.25} />
                    Duplicate and Edit
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Date / saving / done steps — centered card on the cream takeover */
            <div className="mx-auto max-w-lg px-4 py-8">
              <div className="rounded-2xl bg-white p-5 shadow-lg sm:p-6">
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
                ) : (
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
                    flight={flight}
                    onFlightChange={setFlight}
                    airports={template.itinerary?.airports?.length ? template.itinerary.airports : Object.keys(AIRPORTS)}
                    dayOneFirstTime={dayOneFirstTime}
                    lastDayLastTime={lastDayLastTime}
                    onBack={() => setSaveState('idle')}
                    onConfirm={handleConfirm}
                    saving={saveState === 'saving'}
                  />
                )}
              </div>
            </div>
          )}
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
  flight,
  onFlightChange,
  airports,
  dayOneFirstTime,
  lastDayLastTime,
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
  flight: TripFlight
  onFlightChange: (f: TripFlight) => void
  airports: string[]
  dayOneFirstTime?: string
  lastDayLastTime?: string
  onBack: () => void
  onConfirm: () => void
  saving: boolean
}) {
  const from = range?.from
  const to = range?.to
  const depTime = flight.departure?.time
  const depTight = depTime ? departureTooTight(lastDayLastTime, depTime, flight.departure?.nextDay) : false
  const depAfter = depTime ? departureIsAfter(lastDayLastTime, depTime, flight.departure?.nextDay) : false
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

      {/* Optional flights — personalizes the copy: arrival → Day 1, departure → last day */}
      <div className="space-y-2 border border-zen-black/10 rounded-xl bg-white p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-basel-brick flex items-center gap-1.5">
          <Plane size={12} strokeWidth={2.5} /> เที่ยวบิน · Flights
          <span className="text-zen-black/40 font-medium normal-case tracking-normal">(ไม่บังคับ)</span>
        </p>
        {(['arrival', 'departure'] as const).map((leg) => (
          <div key={leg} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-12 text-[11px] font-bold text-zen-black/50">{leg === 'arrival' ? 'ขาเข้า' : 'ขาออก'}</span>
              <select
                value={flight[leg]?.airport ?? ''}
                onChange={(e) => onFlightChange({ ...flight, [leg]: { ...flight[leg], airport: e.target.value || undefined } })}
                className="flex-1 min-w-0 text-sm border border-zen-black/20 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">สนามบิน · Airport</option>
                {airports.map((code) => (
                  <option key={code} value={code}>{AIRPORTS[code]?.label ?? code}</option>
                ))}
              </select>
              <select
                value={flight[leg]?.time ?? ''}
                onChange={(e) => onFlightChange({ ...flight, [leg]: { ...flight[leg], time: e.target.value || undefined } })}
                className="w-28 text-sm border border-zen-black/20 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">เวลา</option>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h} น.</option>
                ))}
              </select>
            </div>
            {leg === 'departure' && flight.departure?.time && (
              <label className="flex items-center justify-end gap-1.5 text-[11px] text-zen-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!flight.departure?.nextDay}
                  onChange={(e) => onFlightChange({ ...flight, departure: { ...flight.departure, nextDay: e.target.checked } })}
                  className="accent-basel-brick"
                />
                {to
                  ? `ออกเดินทางวันถัดไป (${addDays(to, 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`
                  : 'ออกเดินทางวันถัดไป'}
              </label>
            )}
          </div>
        ))}
        <p className="text-[10px] text-zen-black/40 leading-relaxed">
          ใส่เที่ยวบินเพื่อให้ระบบเพิ่มจุดรับ-ส่งสนามบินในวันแรก/วันสุดท้าย (เที่ยวบินกลางคืนถึงเช้า = เที่ยววันแรกได้เต็มวัน)
        </p>
        {valid && flight.arrival?.time && arrivalTooLate(flight.arrival.time, dayOneFirstTime) && (
          <div className="flex items-start gap-2 text-[11px] leading-relaxed bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-900">
            <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <span>
              เครื่องถึง <b>{flight.arrival.time} น.</b> + เผื่อเดินทางจากสนามบิน ~2 ชม. อาจไม่ทันแผนวันแรกที่เริ่ม <b>{dayOneFirstTime} น.</b>
              <br />พี่ ๆ สามารถปรับได้ที่ <b>My Trip</b> หลังยืนยันและคัดลอกครับ —{' '}
              {freeDays > 0 ? (
                <>เนื่องจากเลือกวันยาวกว่าแผน จะ <b>เลื่อนแผนลง 1 วัน</b> เพิ่มวันอิสระวันแรกโดยใช้วันอิสระที่มีอยู่ (<b>ไม่เสียกิจกรรม</b>)</>
              ) : (
                <>ทริปยาวเท่าแผนพอดี จะ <b>แทนที่แผนวันแรกด้วยวันอิสระ</b> (เสียกิจกรรมวันแรก) หรือปรับเวลาเอง</>
              )}
            </span>
          </div>
        )}
        {/* Departure warning — only once BOTH dates are picked AND the flight is too tight / impossible */}
        {valid && depTight && (
          <div className="flex items-start gap-2 text-[11px] leading-relaxed rounded-lg px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900">
            <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
            <span>
              {depAfter ? (
                <>กิจกรรมสุดท้ายจบ ~<b>{lastDayLastTime} น.</b> หลังเวลาบิน <b>{depTime} น.</b> — มีบางที่ไปไม่ได้แล้วครับ ลองปรับเวลา แก้ไข/ลบ/สลับกิจกรรม ที่ <b>My Trip</b> ดูนะครับ</>
              ) : (
                <>กิจกรรมสุดท้ายจบ ~<b>{lastDayLastTime} น.</b> ใกล้เวลาบิน <b>{depTime} น.</b> — อาจไม่ทันครับ ลองปรับเวลา แก้ไข/ลบ/สลับกิจกรรม ที่ <b>My Trip</b> ดูนะครับ</>
              )}
            </span>
          </div>
        )}
        {/* Airport check-in reminder — always shown */}
        <div className="flex items-start gap-2 text-[11px] leading-relaxed rounded-lg px-3 py-2 bg-zen-black/[0.03] border border-zen-black/10 text-zen-black/60">
          <Plane size={13} className="text-zen-black/40 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <span>อย่าลืมเผื่อ<b>เดินทางไปสนามบิน ~2 ชม.</b> + เช็คอิน <b>อย่างน้อย 3 ชม.</b> (4 ชม. ถ้าต้องขอคืนภาษี VAT)</span>
        </div>
      </div>

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
