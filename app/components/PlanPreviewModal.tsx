'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { useSession, signIn } from 'next-auth/react'
import { DayPicker, type DateRange } from 'react-day-picker'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowLeft, CalendarDays, CalendarCheck, AlertTriangle, Plane, ChevronDown, ChevronLeft, Share2, Check, Copy } from 'lucide-react'
import 'react-day-picker/style.css'
import Image from 'next/image'
import { OverviewPanel, ItineraryPanel, DayChips, type DaySel } from '@/app/components/TripPreviewPanels'
import type { PlanTemplate } from '@/app/components/PlanCard'
import type { Itinerary } from '@/app/components/TemplateCard'
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
 * in My Trips.
 */
export default function PlanPreviewModal({
  template,
  defaultStartDate = '',
  defaultEndDate = '',
  callbackUrl,
  viewOnly = false,
  travelDateLabel,
  onDeleteTrip,
  reviewTitle,
  savedTrip = false,
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
  /** A SAVED trip's chosen window, shown in the overview ("16 ต.ค. - 24 ต.ค.").
   *  Templates have no dates, so /discover leaves this unset. */
  travelDateLabel?: string | null
  /** SAVED trips only: shows a "Delete this trip" action at the end of the
   *  overview. The caller owns the confirmation dialog and the request. */
  onDeleteTrip?: () => void
  /** Back-face heading of the summary card (default "Admin Review"). */
  reviewTitle?: string
  /** Saved-trip layout for the summary card (rows instead of stat tiles). */
  savedTrip?: boolean
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

  // The list payload (GET /api/templates) omits the itinerary for size — fetch
  // it on demand the first time a template is opened, keyed by id so reopening
  // is instant. Callers that already pass a full template (admin) skip this.
  const [loadedItins, setLoadedItins] = useState<Record<string, Itinerary>>({})
  const itinerary = template ? (template.itinerary ?? loadedItins[template.id]) : undefined
  useEffect(() => {
    if (!template || template.itinerary || loadedItins[template.id]) return
    let active = true
    fetch(`/api/templates/${template.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (active && d.template?.itinerary)
          setLoadedItins((m) => ({ ...m, [template.id]: d.template.itinerary }))
      })
      .catch(() => {})
    return () => { active = false }
  }, [template, loadedItins])

  const tripDays = template?.totalDays ?? itinerary?.days?.length ?? 1
  // Per-cover place names (overview.cover_places, same order as the gallery).
  const coverPlaces = isV3(itinerary) ? (itinerary.overview.cover_places ?? []) : []

  // The plan's Day-1 first scheduled time — to warn if the flight lands after it.
  const dayOneFirstTime = useMemo(
    () => (itinerary ? getRenderDays(itinerary)[0]?.activities.find((a) => a.time)?.time : undefined),
    [itinerary],
  )
  // The last day's last activity END time — to warn if departure is too tight.
  const lastDayLastTime = useMemo(() => {
    if (!itinerary) return undefined
    const days = getRenderDays(itinerary)
    return lastActivityEndTime(days[days.length - 1]?.activities ?? [])
  }, [itinerary])

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
    // totalDays is non-null in the DB; the itinerary may not be fetched yet, so
    // don't reach into it here (it'd also drag it into this reset effect's deps).
    const days = template.totalDays ?? 1
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

  // Step 2 → save: requires a valid range (start + end, ≥ plan length) AND the
  // lazily-fetched itinerary (arrives well before a human can pick dates; the
  // guard covers a failed fetch, where saving a trip without content is worse).
  async function handleConfirm() {
    if (!template || !from || !valid || !itinerary) return
    setSaveState('saving')
    // Pad the plan with free days when the chosen window is longer than the plan.
    const itineraryToSave =
      freeDays > 0 ? extendItineraryWithFreeDays(itinerary, tripLength) : itinerary
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

      // Auto-generate a fresh activation code so it's ready to redeem in My Trips
      // (revealed there, not here — now always bound to the chosen travel dates).
      // Prefix from the template's PROVINCE (e.g. HOK from HOK-001), not the first
      // city (Sapporo→SAP), so the personal code matches the plan's province.
      try {
        const prefix = template.shareCode?.split('-')[0] || itinerary?.days?.[0]?.location || 'JPN'
        await fetch('/api/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripId: trip.id, primaryCity: prefix }),
        })
      } catch {
        // Non-fatal — the user can still generate the code in My Trips.
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

              {/* Tab content — Kimi-style summary/highlights + day timelines.
                  The itinerary arrives from the lazy fetch (usually <1s); a
                  pulse placeholder holds the space until it does. */}
              <div className={`mx-auto max-w-2xl px-4 pt-6 ${viewOnly ? 'pb-16' : 'pb-32'}`}>
                {!itinerary ? (
                  <div className="space-y-3 py-4" aria-busy>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-20 animate-pulse rounded-2xl bg-zen-black/5" />
                    ))}
                  </div>
                ) : tab === 'overview' ? (
                  <OverviewPanel
                    itinerary={itinerary}
                    tripDays={tripDays}
                    travelDateLabel={travelDateLabel}
                    onDeleteTrip={onDeleteTrip}
                    reviewTitle={reviewTitle}
                    savedTrip={savedTrip}
                    // Tap a highlight row → that day, in the Itinerary tab.
                    // (No scroll reset — layoutScroll on the shell keeps the
                    // pill's slide correct regardless of scroll position.)
                    onDayTap={(day) => {
                      setSelDay(day)
                      setTab('itinerary')
                    }}
                  />
                ) : (
                  <ItineraryPanel itinerary={itinerary} sel={selDay} />
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
            /* Date / saving / done steps — centered card on the cream takeover.
               -mt-7 + z-10 mirrors the preview's tab pill: the hero reserves
               ~48px of cream under the title, so without pulling back over
               that seam the card floated far below the trip name. */
            <div className="relative z-10 mx-auto -mt-7 max-w-lg px-4 pb-8">
              <div className="rounded-2xl bg-white p-5 shadow-lg sm:p-6">
                {saveState === 'done' ? (
                  <div className="space-y-4 py-6 text-center font-detail">
                    {/* Ocean tint + the lucide check, not a green circle with a
                        text glyph: the palette carries ONE accent, and the
                        check mark already says "done" without a second hue. */}
                    <div className="mx-auto grid size-16 place-items-center rounded-full bg-basel-brick/10">
                      <Check className="size-7 text-basel-brick" strokeWidth={3} aria-hidden />
                    </div>
                    <h3 className="text-lg font-extrabold tracking-tight text-zen-black">คัดลอกเรียบร้อย!</h3>
                    <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-graphite/80">
                      เพิ่มทริปของคุณในหน้า My Trips แล้ว — แก้ไขได้อิสระ และรับรหัส LINE ได้ที่นั่นเลย
                    </p>
                    {/* Both buttons are rounded-full pills now (was rounded-lg
                        uppercase blocks). The secondary also sets text-zen-black
                        EXPLICITLY — it inherited the modal's light chrome colour
                        before, which left its label nearly invisible on white. */}
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                      <Link
                        href="/my-trips"
                        className="flex-1 rounded-full bg-zen-black py-3 text-center text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick"
                      >
                        Go to My Trips
                      </Link>
                      <button
                        onClick={handleClose}
                        className="flex-1 rounded-full border border-zen-black/15 bg-white py-3 text-sm font-semibold text-zen-black transition-colors hover:border-basel-brick/50 hover:text-basel-brick"
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
                    airports={itinerary?.airports?.length ? itinerary.airports : Object.keys(AIRPORTS)}
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

/**
 * Single-select dropdown in the app's own control language: a rounded-full
 * pill trigger with a rotating chevron, and a rounded-2xl popover list — the
 * same vocabulary as the filter modal's destination select.
 *
 * NOT a native <select>: its dropdown is drawn by the OS (unstyleable, and it
 * highlights with the system blue), and its built-in arrow can't be
 * positioned — which is exactly what looked off here.
 */
function PillSelect({
  value,
  onChange,
  options,
  placeholder,
  widthClass = 'flex-1',
  alignRight = false,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  widthClass?: string
  /** Open the list leftward — for a narrow control near the right edge. */
  alignRight?: boolean
}) {
  const [open, setOpen] = useState(false)
  // Empty value falls back to the muted placeholder rather than the ''
  // option's own label, so "not chosen" reads as a hint, not a choice.
  const current = value ? options.find((o) => o.value === value) : undefined
  return (
    <div className={`relative min-w-0 ${widthClass}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-1.5 rounded-full border border-zen-black/15 bg-white py-2 pl-4 pr-3 text-sm transition-colors hover:border-basel-brick/50"
      >
        <span className={`truncate ${current ? 'font-medium text-zen-black' : 'text-graphite/60'}`}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-graphite/50 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.25}
          aria-hidden
        />
      </button>
      {open && (
        <>
          {/* Outside-click catcher, under the list and above everything else. */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={`absolute top-full z-30 mt-1.5 max-h-56 w-max min-w-full max-w-[15rem] overflow-y-auto rounded-2xl border border-zen-black/10 bg-white p-1 shadow-xl shadow-black/10 ${
              alignRight ? 'right-0' : 'left-0'
            }`}
          >
            {options.map((o) => {
              const active = o.value === value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-basel-brick/10 font-semibold text-basel-brick'
                      : 'text-zen-black hover:bg-zen-black/5'
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {active && <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
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
    // font-detail + space-y-4: the trip-detail panels' own shell, so this step
    // reads as the same product rather than a different form.
    <div className="space-y-4 font-detail">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          disabled={saving}
          className="text-graphite/50 transition-colors hover:text-zen-black disabled:opacity-40"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        {/* The overview cards' heading scale (was font-headline black xl). */}
        <h3 className="text-lg font-extrabold tracking-tight text-zen-black">เลือกช่วงวันเดินทางของคุณ </h3>
      </div>
      <p className="text-[13px] leading-relaxed text-graphite">
        <span className="mr-2">แพลนทริปนี้มี {tripDays} วัน</span>
        <span className="mr-2">&bull;</span>
        <span>สามารถเลือกมากกว่า {tripDays} วันได้</span>
        <br />
        <span className="text-graphite/70">
          โดยวันที่เกินมาระบบจะใส่ให้เป็นวันอิสระ (Free Day) <br /> (สามารถแก้ไขเพิ่มลดจำนวนวันได้ที่ My Trips)
        </span>
      </p>  

      {/* Calendar — a white rounded-3xl card like every overview section, with
          the range summary as a cream sub-block inside it. */}
      <section className="rounded-3xl border border-zen-black/10 bg-white p-4 shadow-sm">
        {/* text-zen-black is EXPLICIT: this step renders inside the modal's
            light-on-dark chrome, and the day numbers inherited that near-white
            colour — invisible on the white card. */}
        <div className="rdp-brand flex justify-center text-zen-black">
          <DayPicker
            mode="range"
            min={1}
            selected={range}
            onSelect={onChange}
            defaultMonth={from ?? today}
            numberOfMonths={1}
            disabled={{ before: today }}
            showOutsideDays
            // Vars go on the DayPicker ROOT, not a wrapper: react-day-picker
            // declares `--rdp-accent-color: blue` on `.rdp-root` itself, so an
            // ancestor's value is always overridden by the picker's own
            // declaration (that's why the nav arrows were rdp's default blue).
            style={
              {
                '--rdp-accent-color': '#5B88B2',
                '--rdp-accent-background-color': '#E7EEF5',
                '--rdp-today-color': '#5B88B2',
                '--rdp-range_middle-color': '#122C4F',
              } as React.CSSProperties
            }
          />
        </div>

        {/* Range summary */}
        {from && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-briefing-cream px-3 py-2.5">
            <CalendarDays className="size-4 shrink-0 text-basel-brick" strokeWidth={2.25} />
            <span className="text-sm font-semibold text-zen-black">{fmtThai(from)}</span>
            <span className="text-graphite/40">→</span>
            {to ? (
              <span className="text-sm font-semibold text-zen-black">{fmtThai(to)}</span>
            ) : (
              <span className="text-sm font-medium text-graphite/60">เลือกวันสิ้นสุด</span>
            )}
            {/* The details panels' pill (same one "Popular" uses). */}
            {valid && (
              <span className="rounded-full bg-basel-brick/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-basel-brick">
                {tripLength} วัน
              </span>
            )}
          </div>
        )}
      </section>

      {/* Too short for the plan — BLOCKING, so it gets the loudest on-palette
          treatment (Ocean tint + Midnight text) rather than the old red. */}
      {tooShort && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-basel-brick/10 px-4 py-3 text-[13px] leading-relaxed text-zen-black">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-basel-brick" strokeWidth={2.25} />
          <span>
            แผนนี้มี <span className="font-bold">{tripDays} วัน</span> — กรุณาเลือกช่วงให้ครอบคลุมอย่างน้อย {tripDays} วัน
          </span>
        </div>
      )}

      {/* Free days appended — informational, so the cream sub-block. */}
      {valid && freeDays > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-briefing-cream px-4 py-3 text-[13px] leading-relaxed text-graphite/80">
          <CalendarCheck className="mt-0.5 size-4 shrink-0 text-basel-brick" strokeWidth={2.25} />
          <span>
            ช่วงวันที่คุณเลือกยาวกว่าแผนสำเร็จรูป {tripDays} วัน อยู่{' '}
            <span className="font-bold">{freeDays} วัน</span> — ระบบจะเพิ่ม
            <span className="font-bold"> {freeDays} วันอิสระ</span> ต่อท้ายให้ คุณวางแผนเองได้ที่ My Trips
          </span>
        </div>
      )}

      {/* Optional flights — personalizes the copy: arrival → Day 1, departure → last day */}
      <section className="space-y-2 rounded-3xl border border-zen-black/10 bg-white p-5 shadow-sm">
        {/* Section label in the overview panels' vocabulary (text-xs bold
            uppercase tracking-wider Ocean + a size-3.5 glyph). */}
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-basel-brick">
          <Plane className="size-3.5" strokeWidth={2.25} /> เที่ยวบิน · Flights
          <span className="font-medium normal-case tracking-normal text-graphite/50">(ไม่บังคับ)</span>
        </p>
        {(['arrival', 'departure'] as const).map((leg) => (
          <div key={leg} className="space-y-1">
            {/* Label on its OWN line, not a 48px gutter: airport labels run
                long ("Narita (NRT)") and the side-by-side layout clipped them
                inside the pill. Full width now goes to the two controls. */}
            <p className="text-[11px] font-bold uppercase tracking-wider text-graphite/70">
              {leg === 'arrival' ? 'ขาเข้า · Arrival' : 'ขาออก · Departure'}
            </p>
            <div className="flex items-center gap-2">
              <PillSelect
                value={flight[leg]?.airport ?? ''}
                onChange={(v) => onFlightChange({ ...flight, [leg]: { ...flight[leg], airport: v || undefined } })}
                placeholder="สนามบิน"
                options={[
                  { value: '', label: 'ยังไม่ระบุ · Later' },
                  ...airports.map((code) => ({ value: code, label: AIRPORTS[code]?.label ?? code })),
                ]}
              />
              <PillSelect
                value={flight[leg]?.time ?? ''}
                onChange={(v) => onFlightChange({ ...flight, [leg]: { ...flight[leg], time: v || undefined } })}
                placeholder="เวลา"
                // w-32, not w-24: the pill's own padding (16+12) + chevron +
                // gap eat ~50px, so 96px left barely 46px of text and "01:00
                // น." truncated. 128px leaves it room to sit whole.
                widthClass="w-32 shrink-0"
                alignRight
                options={[
                  { value: '', label: 'ยังไม่ระบุ · Later' },
                  ...HOURS.map((h) => ({ value: h, label: `${h} น.` })),
                ]}
              />
            </div>
            {leg === 'departure' && flight.departure?.time && (
              <label className="flex cursor-pointer items-center justify-end gap-1.5 text-[11px] text-graphite/80">
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
        <p className="text-[11px] leading-relaxed text-graphite/60">
          ใส่เที่ยวบินเพื่อให้ระบบเพิ่มจุดรับ-ส่งสนามบินในวันแรก/วันสุดท้าย (เที่ยวบินกลางคืนถึงเช้า = เที่ยววันแรกได้เต็มวัน)
        </p>
        {/* Amber stays ONLY on the two real-risk callouts (a missed flight is
            not a style question) — borderless tint, like the cream blocks. */}
        {valid && flight.arrival?.time && arrivalTooLate(flight.arrival.time, dayOneFirstTime) && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" strokeWidth={2.25} />
            <span>
              เครื่องถึง <b>{flight.arrival.time} น.</b> + เผื่อเดินทางจากสนามบิน ~2 ชม. อาจไม่ทันแผนวันแรกที่เริ่ม <b>{dayOneFirstTime} น.</b>
              <br />พี่ ๆ สามารถปรับได้ที่ <b>My Trips</b> หลังยืนยันและคัดลอกครับ —{' '}
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
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" strokeWidth={2.25} />
            <span>
              {depAfter ? (
                <>กิจกรรมสุดท้ายจบ ~<b>{lastDayLastTime} น.</b> หลังเวลาบิน <b>{depTime} น.</b> — มีบางที่ไปไม่ได้แล้วครับ ลองปรับเวลา แก้ไข/ลบ/สลับกิจกรรม ที่ <b>My Trips</b> ดูนะครับ</>
              ) : (
                <>กิจกรรมสุดท้ายจบ ~<b>{lastDayLastTime} น.</b> ใกล้เวลาบิน <b>{depTime} น.</b> — อาจไม่ทันครับ ลองปรับเวลา แก้ไข/ลบ/สลับกิจกรรม ที่ <b>My Trips</b> ดูนะครับ</>
              )}
            </span>
          </div>
        )}
        {/* Airport check-in reminder — always shown; the panels' cream block. */}
        <div className="flex items-start gap-2 rounded-2xl bg-briefing-cream px-3 py-2.5 text-[11px] leading-relaxed text-graphite/70">
          <Plane className="mt-0.5 size-3.5 shrink-0 text-graphite/50" strokeWidth={2.25} />
          <span>อย่าลืมเผื่อ<b>เดินทางไปสนามบิน ~2 ชม.</b> + เช็คอิน <b>อย่างน้อย 3 ชม.</b> (4 ชม. ถ้าต้องขอคืนภาษี VAT)</span>
        </div>
      </section>

      {/* Same pill as the preview's own "Duplicate and Edit" CTA — Midnight
          rounded-full, Ocean on hover (was a wide-tracked uppercase block). */}
      <button
        onClick={onConfirm}
        disabled={!valid || saving}
        className="w-full rounded-full bg-zen-black py-3.5 text-sm font-semibold text-white shadow-md shadow-zen-black/25 transition-all hover:bg-basel-brick disabled:opacity-50 disabled:hover:bg-zen-black"
      >
        {saving ? 'กำลังคัดลอก...' : 'ยืนยันและคัดลอกไปยัง My Trips'}
      </button>
      {!valid && !tooShort && (
        <p className="-mt-1 text-center text-[12px] text-graphite/70">
          {complete ? 'กรุณาเลือกช่วงวันเดินทาง' : from ? 'เลือกวันสิ้นสุดของการเดินทาง · Pick an end date' : 'เลือกช่วงวันเดินทางก่อน · Pick your travel dates'}
        </p>
      )}
    </div>
  )
}
