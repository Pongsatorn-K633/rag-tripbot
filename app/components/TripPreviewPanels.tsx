'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import useEmblaCarousel from 'embla-carousel-react'
import { CalendarDays, CalendarCheck, Car, MapPin, ChevronRight, Pencil, Plane, RefreshCw, Footprints, Trash2 } from 'lucide-react'
import { safeHref } from '@/lib/url'
import JapanIcon from '@/app/components/JapanIcon'
import type { AnyItinerary, Choice, TripFlight } from '@/lib/itinerary-types'
import { AIRPORTS, getRenderDays, isV3, v3DayHighlight } from '@/lib/trips/itinerary-model'
import { parsePeriod } from '@/lib/trips/import-plan'

/**
 * Trip-preview tab panels (fullscreen PlanPreviewModal) — ported from the Kimi
 * "Page Design Tweaks" build (sections/OverviewPanel + DayTimeline + TripTabs),
 * which was authored directly in our tokens. Day-chip selection state lives in
 * the modal (the chips render under the tab pill, per that design).
 *
 * STRUCTURE-FIRST MOCK: a template has no travel dates, no distances and no
 * editing, so those render as literal "XX" placeholders / inert buttons until
 * the detail pass (dates arrive on duplication; km needs Maps data; Auto Fill /
 * Add Activity belong to the owned-trip editor).
 *
 * Detail text uses `font-detail` (Plus Jakarta Sans, Thai falls back to Noto).
 */

export type DaySel = number | 'all'

/** One timeline row — three kinds, per the original ItineraryView logic:
 *  a plain activity, a LOGISTICS connector (transport — rendered muted, not as
 *  a destination), or a CHOICE (meal slot — its options stacked underneath). */
type OptionCard = {
  name: string
  duration?: string
  cost?: string
  notes?: string
  mapUrl?: string | null
  walkingUrl?: string | null
  recommended: boolean
  selected: boolean
}

type Row = {
  time?: string
  name: string
  duration?: string
  isLogistics?: boolean
  emoji?: string | null
  mapUrl?: string | null
  walkingUrl?: string | null
  choice?: { label: string; options: OptionCard[] }
}

function choiceRow(c: Choice): Row {
  const pick = c.options[c.selected ?? c.recommended ?? 0]
  return {
    time: c.time,
    name: pick?.name ?? c.label,
    duration: pick?.duration,
    choice: {
      label: c.label,
      options: c.options.map((o, i) => ({
        name: o.name,
        duration: o.duration,
        cost: o.cost,
        notes: o.notes,
        mapUrl: o.mapUrl,
        walkingUrl: o.walkingUrl,
        recommended: c.recommended === i,
        selected: c.selected === i,
      })),
    },
  }
}

function dayRows(day: ReturnType<typeof getRenderDays>[number]): Row[] {
  const rows: Row[] = [
    ...day.activities.map((a) => ({
      time: a.time,
      name: a.name,
      duration: a.duration,
      isLogistics: a.isLogistics,
      emoji: a.emoji,
      mapUrl: a.mapUrl,
      walkingUrl: a.walkingUrl,
    })),
    ...(day.choices ?? []).map(choiceRow),
  ]
  // Timed rows in clock order; untimed sink to the end.
  return rows.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
}

/** Period-details renderer — one <p> per authored line, with a "Place:" prefix
 *  bolded (Tateyama: …). URL lines stay plain: "https:" would false-match the
 *  colon split, so http(s) prefixes are excluded. */
function DetailLines({ text }: { text: string }) {
  return (
    <div className="mt-1 space-y-1">
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim()
        // URL lines become real links (safeHref-guarded, like every href sink).
        const href = /^https?:\/\//i.test(trimmed) ? safeHref(trimmed) : undefined
        if (href) {
          return (
            <p key={i} className="text-[13px] leading-relaxed">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-medium text-basel-brick underline-offset-2 hover:underline"
              >
                {trimmed}
              </a>
            </p>
          )
        }
        const m = line.match(/^([^:]{1,28}):\s*(.+)$/)
        const isPlace = m && !/^https?$/i.test(m[1])
        return (
          <p key={i} className="text-[13px] leading-relaxed text-graphite/80">
            {isPlace ? (
              <>
                <span className="font-bold text-zen-black">{m[1]}</span>: {m[2]}
              </>
            ) : (
              line
            )}
          </p>
        )
      })}
    </div>
  )
}

/** Season emoji, derived from the window's start month — DERIVED, not data:
 *  emoji inside the primary string would break parsePeriod (and with it the
 *  availability derivation). */
function seasonEmoji(primary?: string): string | null {
  const from = parsePeriod(primary)?.from
  if (!from) return null
  const month = parseInt(from.slice(0, 2), 10)
  if (month === 12 || month <= 2) return '❄️'
  if (month <= 5) return '🌸'
  if (month <= 8) return '☀️'
  return '🍁'
}

/** One recommended window — collapsible: the date range always visible, the
 *  per-area breakdown on demand (same accordion vocabulary as the day cards). */
function PeriodBlock({ primary, details, popular }: { primary?: string; details?: string; popular?: boolean }) {
  const [open, setOpen] = useState(false)
  const has = !!details?.trim()
  const emoji = seasonEmoji(primary)
  return (
    <div className="rounded-2xl bg-briefing-cream">
      <button
        type="button"
        onClick={() => has && setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 p-3 text-left ${has ? '' : 'cursor-default'}`}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-zen-black">
          <span>
            {emoji && <span className="mr-1.5">{emoji}</span>}
            {primary}
          </span>
          {popular && (
            <span className="rounded-full bg-basel-brick/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-basel-brick">
              Popular
            </span>
          )}
        </span>
        {has && (
          <ChevronRight
            className={`size-4 shrink-0 text-graphite/50 transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          />
        )}
      </button>
      {open && has && <div className="-mt-2 px-3 pb-3">{details && <DetailLines text={details} />}</div>}
    </div>
  )
}

/** Map / walking-route chips — hrefs pass through safeHref (the stored-XSS
 *  fix): javascript:/data: URLs render as nothing. */
function LinkChips({ mapUrl, walkingUrl }: { mapUrl?: string | null; walkingUrl?: string | null }) {
  const map = safeHref(mapUrl)
  const walk = safeHref(walkingUrl)
  if (!map && !walk) return null
  const chip =
    'inline-flex items-center gap-1 rounded-full border border-zen-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-basel-brick transition-colors hover:border-basel-brick/50'
  return (
    <span className="flex flex-wrap gap-1.5">
      {map && (
        <a href={map} target="_blank" rel="noopener noreferrer" className={chip}>
          <MapPin className="size-3" strokeWidth={2.25} /> Map
        </a>
      )}
      {walk && (
        <a href={walk} target="_blank" rel="noopener noreferrer" className={chip}>
          <Footprints className="size-3" strokeWidth={2.25} /> เส้นทางเดิน
        </a>
      )}
    </span>
  )
}

// ── Day chips — rendered by the MODAL under the tab pill (itinerary tab) ─────

export function DayChips({ count, sel, onSel }: { count: number; sel: DaySel; onSel: (v: DaySel) => void }) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
      active
        ? 'bg-zen-black text-white shadow-md shadow-zen-black/25'
        : 'border border-zen-black/10 bg-white text-graphite hover:border-basel-brick/50 hover:text-zen-black'
    }`
  const scrollerRef = useRef<HTMLDivElement>(null)
  // "More to the right" affordance — live, so it never lies: shown only while
  // the scroller actually has content past the right edge.
  const [more, setMore] = useState(false)
  const [past, setPast] = useState(false)
  const update = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    setPast(el.scrollLeft > 4)
  }, [])
  useEffect(() => {
    // rAF: measure after layout — and the async callback keeps the setState
    // out of the effect body (set-state-in-effect rule).
    const id = requestAnimationFrame(update)
    return () => cancelAnimationFrame(id)
  }, [count, update])

  return (
    <div className="relative -mx-4">
      {/* pt-1/pb-3: an overflow-x scroller clips vertical overflow too, so the
          chips' drop shadows need breathing room inside it or they slice off. */}
      <div ref={scrollerRef} onScroll={update} className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto px-4 pb-3 pt-1 font-detail">
        <button type="button" onClick={() => onSel('all')} className={chip(sel === 'all')}>
          All
        </button>
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" onClick={() => onSel(i + 1)} className={chip(sel === i + 1)}>
            Day {i + 1}
          </button>
        ))}
      </div>
      {/* Edge fades — live both ways: right = "continues →", left = "← more
          back there" (the All chip hides off-left once scrolled). */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-briefing-cream to-transparent transition-opacity duration-200 ${
          more ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-briefing-cream to-transparent transition-opacity duration-200 ${
          past ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}

/** One horizontal fact row in the Trip-summary card: Ocean glyph, then a
 *  "Label — value" line. Every row shares this shell so the icon column and
 *  the indent line up down the whole stack. */
/**
 * One pill in the trip summary. Pass `onEdit` to make it editable: the whole
 * pill becomes the tap target and a pencil appears at its right end, so the
 * affordance is visible without a second control competing with the content.
 */
function SummaryRow({
  icon,
  children,
  onEdit,
  editLabel,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onEdit?: () => void
  editLabel?: string
}) {
  // items-CENTER, not items-start: the glyph is 20px and a text-xs line box
  // is 16px, so top-aligning them left every label sitting ~2px high against
  // its icon. Centring also reads right for the two-line flights row — the
  // plane centres against the pair.
  const base = 'flex w-full items-center gap-3.5 rounded-2xl bg-briefing-cream py-2.5 pl-5 pr-3'
  if (!onEdit) {
    return (
      <div className={base}>
        {icon}
        <div className="min-w-0">{children}</div>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={editLabel}
      className={`${base} group text-left transition-colors hover:bg-basel-brick/10`}
    >
      {icon}
      {/* min-w-0 + the ml-auto pencil: the content keeps its left alignment and
          truncates against the pencil rather than pushing it off the pill. */}
      <div className="min-w-0 flex-1">{children}</div>
      <Pencil
        className="ml-auto size-3.5 shrink-0 text-graphite/40 transition-colors group-hover:text-basel-brick"
        strokeWidth={2.5}
        aria-hidden
      />
    </button>
  )
}

// ── Overview tab — Trip summary + Highlights + Admin Review ────────────────

export function OverviewPanel({
  itinerary,
  tripDays,
  onDayTap,
  travelDateLabel,
  onDeleteTrip,
  reviewTitle = 'Admin Review',
  savedTrip = false,
  onEditTravel,
  onEditCar,
  onEditNote,
  editItineraryHref,
}: {
  itinerary: AnyItinerary
  tripDays: number
  /** Tap a highlight row → open that day in the Itinerary tab. */
  onDayTap?: (day: number) => void
  /** A SAVED trip's chosen window ("16 ต.ค. - 24 ต.ค."). Templates have no
   *  dates, so this is absent on /discover and the row simply doesn't render.
   *  The flights beside it come from the itinerary itself (`.flight`), which
   *  is where the duplicate step stores them. */
  travelDateLabel?: string | null
  /** SAVED trips only: a destructive action pinned to the end of the overview
   *  (a template can't be deleted from here). The caller owns the confirm. */
  onDeleteTrip?: () => void
  /** Back-face heading. /my-trips calls it "Notes:" — once a trip is yours the
   *  text reads as your own notes, not an admin's pitch; /discover keeps the
   *  default "Admin Review". The flip pill follows this word. */
  reviewTitle?: string
  /** /my-trips layout: the three stat tiles collapse into the same row stack
   *  as the dates/flights/car, and the day count moves into the dates row. */
  savedTrip?: boolean
  /** SAVED trips only. Given, the dates and flights pills become editable
   *  (pencil + tap → the caller's date/flight picker). Dates and flights share
   *  ONE handler because they share one editor — the picker sets both. */
  onEditTravel?: () => void
  /** SAVED trips only: edit the car-rental duration. */
  onEditCar?: () => void
  /** SAVED trips only: edit the note on the card's back face ("Notes:"). */
  onEditNote?: () => void
  /** SAVED trips only: where the ✏️ beside "Day Highlights" goes — the full
   *  itinerary editor (/trips/[id]/edit). */
  editItineraryHref?: string
}) {
  const days = getRenderDays(itinerary)
  const v3 = isV3(itinerary) ? itinerary : null
  // Attractions = REAL activities only ("Activity N" slots). Counting every
  // timeline row inflates wildly — 6 meal slots/day + Logistics legs made an
  // 8-day trip read "69 activities". Legacy v1/v2 fall back to plain rows.
  const attractionCount = v3
    ? v3.days.reduce((n, d) => n + (d.activities ?? []).filter((a) => a.slot?.startsWith('Activity')).length, 0)
    : days.reduce((n, d) => n + d.activities.length, 0)
  // Prefectures — derived from the TITLE segments ("Tokyo - Nagano" → 2): the
  // title is authored as the prefecture route by convention. HEURISTIC until
  // the schema carries per-day area codes — day names are creative titles
  // ("All Roads Lead to Matsumoto"), so counting them is hopeless. Legacy
  // v1/v2 fall back to unique day locations.
  const cityCount = v3
    ? new Set(
        v3.title
          .split(/\s*[-–&,]\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
      ).size
    : new Set(days.map((d) => d.location).filter(Boolean)).size
  // Day-by-day highlights, DERIVED (no schema change): each day's Must-priority
  // attractions, falling back to Recommends, then the first attraction. Admins
  // already steer this via the existing priority dropdown. Max 2 per day.
  // Shared with the Itinerary tab's day headers — see v3DayHighlight.
  const dayHighlights = v3
    ? v3.days.map((d) => ({ day: d.day, ...v3DayHighlight(d) }))
    : days.map((d) => ({ day: d.day, names: d.activities.slice(0, 1).map((a) => a.name), emoji: null }))
  // Tagline (short cover hook) under the heading; the FULL description stays
  // in the Admin Review card — the schema separates the two on purpose.
  const tagline = v3?.overview.cover_tagline
  const note = v3 ? v3.overview.description : (itinerary as { description?: string }).description
  // Travel periods — straight from the V3 overview (authored, not derived).
  const recPeriods = (v3?.overview.recommended_period ?? []).filter((p) => p.primary?.trim())
  const availPeriod = v3?.overview.available_period?.primary?.trim() ? v3.overview.available_period : undefined

  const stats = [
    { icon: CalendarDays, label: 'Days', value: String(tripDays) },
    { icon: MapPin, label: 'Attractions', value: String(attractionCount) },
    { icon: JapanIcon, label: 'Prefectures', value: String(cityCount || 'XX') },
  ]
  // Car rental — a planning fact that changes what a traveller must arrange
  // (an IDP, a driver), so it earns a line on the summary rather than living
  // only in the logistics guide. `primary === 'Y'` is the admin's checkbox.
  const carRental = v3?.overview.car_rental?.primary === 'Y' ? v3.overview.car_rental : null
  const carDuration = carRental?.details?.rentalDuration?.trim()
  // Saved-trip facts: the traveller's flights ride INSIDE the itinerary (the
  // duplicate step writes `itinerary.flight`), so no extra prop is needed.
  const flight = (itinerary as { flight?: TripFlight }).flight
  const flightLegs = (['arrival', 'departure'] as const)
    .map((leg) => ({ leg, info: flight?.[leg] }))
    .filter((l) => l.info?.airport || l.info?.time)

  const [flipped, setFlipped] = useState(false)
  // 3D machinery mounts ONLY while flipping: a permanent perspective/preserve-3d
  // context rasterizes the card into a GPU layer at rest and the text goes soft
  // (same disease as the old will-change blur). At rest the card is a plain flat
  // element — pixel-sharp by construction.
  const [flipping, setFlipping] = useState(false)
  // One-time flip TEASE on first view: the card tilts a few degrees and springs
  // back — motion demonstrates "this rotates" better than any icon can.
  const [teasing, setTeasing] = useState(false)
  const teased = useRef(false)
  const reducedMotion = useReducedMotion() ?? false
  useEffect(() => {
    if (teased.current || reducedMotion) return
    teased.current = true
    const id = window.setTimeout(() => setTeasing(true), 900)
    return () => window.clearTimeout(id)
  }, [reducedMotion])

  function toggleFlip() {
    if (flipping) return
    setTeasing(false)
    setFlipping(true)
    setFlipped((f) => !f)
  }

  // The pill names the face it flips TO, so it follows the heading: the
  // default long "Admin Review" shortens to "Review", a custom one is used
  // as-is (minus a trailing colon).
  const reviewPill = reviewTitle === 'Admin Review' ? 'Review' : reviewTitle.replace(/:\s*$/, '')

  const faceBase = 'flex flex-col rounded-3xl [grid-area:1/1]'
  const frontSkin = 'border border-zen-black/10 bg-white p-5 shadow-sm'
  const backSkin = 'bg-zen-black p-5 shadow-lg shadow-zen-black/25'

  const frontContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-zen-black">Trip summary</h2>
        <FlipHint label={reviewPill} dark={false} onClick={toggleFlip} />
      </div>
      {tagline?.trim() && <p className="mt-0.5 text-sm font-medium text-graphite/70">{tagline}</p>}
      {/* CATALOGUE trip: the three numbers as 3-up tiles. A SAVED trip drops
          them — its day count rides in the วันเดินทาง row, and Attractions /
          Prefectures become rows too, so the card is ONE stack instead of
          tiles-then-rows (two systems reading against each other). */}
      {!savedTrip && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-briefing-cream p-3 text-center">
              <Icon className="mx-auto size-5 text-basel-brick" />
              <p className="mt-1.5 text-lg font-extrabold text-zen-black">{value}</p>
              <p className="text-xs font-medium text-graphite/70">{label}</p>
            </div>
          ))}
        </div>
      )}
      {/* ONE container with space-y — every row is separated by the same gap
          (they each carried their own mt-2 / mt-3 before, so the spacing
          stepped unevenly down the card). */}
      <div className="mt-4 space-y-2">
        {/* Travel window — a SAVED trip's own fact (templates show their
            recommended/available periods instead, further down the panel).
            The day count lives here rather than in a tile of its own. */}
        {travelDateLabel && (
          <SummaryRow
            icon={<CalendarDays className="size-5 shrink-0 text-basel-brick" strokeWidth={2} aria-hidden />}
            onEdit={onEditTravel}
            editLabel="แก้ไขวันเดินทาง · Edit travel dates"
          >
            {/* "เดินทาง 9 วัน — 16 ต.ค. - 24 ต.ค. 2569": the length is part of
                the LABEL now, so the trailing "· 9 วัน" that used to close the
                row is gone (it said the same thing twice). A catalogue trip
                keeps the bare "เดินทาง" — its day count is in the tiles above. */}
            <p className="text-xs font-semibold text-zen-black">
              {savedTrip ? `เดินทาง ${tripDays} วัน` : 'เดินทาง'}
              <span className="text-graphite/70">
                <span className="mx-1.5">—</span>
                {travelDateLabel}
              </span>
            </p>
          </SummaryRow>
        )}
        {/* Flights the traveller entered when duplicating. The plane carries
            no mt-0.5 nudge any more — the row centres its icon itself. */}
        {flightLegs.length > 0 && (
          <SummaryRow
            icon={<Plane className="size-5 shrink-0 text-basel-brick" strokeWidth={2} aria-hidden />}
            onEdit={onEditTravel}
            editLabel="แก้ไขเที่ยวบิน · Edit flights"
          >
            <div className="space-y-0.5">
              {flightLegs.map(({ leg, info }) => (
                <p key={leg} className="text-xs font-semibold text-zen-black">
                  {leg === 'arrival' ? 'ขาเข้า' : 'ขาออก'}
                  <span className="text-graphite/70">
                    <span className="mx-1.5">—</span>
                    {[
                      info?.airport ? (AIRPORTS[info.airport]?.label ?? info.airport) : null,
                      info?.time ? `${info.time} น.${leg === 'departure' && info.nextDay ? ' (วันถัดไป)' : ''}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </p>
              ))}
            </div>
          </SummaryRow>
        )}
        {carRental && (
          <SummaryRow
            icon={<Car className="size-5 shrink-0 text-basel-brick" strokeWidth={2} aria-hidden />}
            onEdit={onEditCar}
            editLabel="แก้ไขจำนวนวันเช่ารถ · Edit car rental days"
          >
            {/* text-xs = the stat tiles' LABEL size. Midnight for the
                statement, graphite for the duration. */}
            <p className="text-xs font-semibold text-zen-black">
              Car Rental
              {carDuration && (
                <span className="text-graphite/70">
                  {/* Margin on the dash, not literal spaces: JSX collapses any
                      run of whitespace to a single space, so mx-* is the only
                      tunable way to widen the gap on both sides. */}
                  <span className="mx-1.5">—</span>
                  {carDuration}
                </span>
              )}
            </p>
          </SummaryRow>
        )}
        {savedTrip && (
          <>
            <SummaryRow icon={<MapPin className="size-5 shrink-0 text-basel-brick" strokeWidth={2} aria-hidden />}>
              <p className="text-xs font-semibold text-zen-black">
                Attractions
                <span className="text-graphite/70"><span className="mx-1.5">—</span>{attractionCount}</span>
              </p>
            </SummaryRow>
            <SummaryRow icon={<JapanIcon className="size-5 shrink-0 text-basel-brick" />}>
              <p className="text-xs font-semibold text-zen-black">
                Prefectures
                <span className="text-graphite/70"><span className="mx-1.5">—</span>{cityCount || 'XX'}</span>
              </p>
            </SummaryRow>
          </>
        )}
      </div>
    </>
  )
  const backContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-extrabold tracking-tight text-briefing-cream/90">{reviewTitle}</p>
        <div className="flex shrink-0 items-center gap-2">
          {/* Notes are the traveller's own text on a saved trip, so they get a
              pencil right here — no round trip to the editor for one paragraph.
              Absent on /discover, where this face is the admin's pitch. */}
          {onEditNote && (
            <button
              type="button"
              onClick={onEditNote}
              aria-label="แก้ไขโน้ต · Edit notes"
              className="grid size-7 place-items-center rounded-full bg-briefing-cream/15 text-briefing-cream/70 transition-colors hover:bg-basel-brick hover:text-white"
            >
              <Pencil className="size-3" strokeWidth={2.5} />
            </button>
          )}
          <FlipHint label="Summary" dark onClick={toggleFlip} />
        </div>
      </div>
      {/* Near-full opacity: this is the pitch, not fine print — and opacity
          dims color EMOJI along with the text, which reads as washed out. */}
      <div className="mt-1.5 text-sm leading-relaxed text-briefing-cream/95">
        <NoteLines text={note?.trim() || 'XX'} />
      </div>
    </>
  )

  return (
    // Card wall: one flow on phones, TWO EXPLICIT COLUMNS from lg —
    //   left  = Trip summary + Travel Periods
    //   right = Day Highlights (the long one)
    //
    // Explicit wrappers, not auto-placement: a grid aligns items into ROWS, so
    // the short summary beside the tall highlights left a dead gap the height
    // of the difference; CSS columns pack tight but decide placement by
    // balancing, which can't be told WHICH card goes right. Two wrappers each
    // own their stack.
    //
    // max-lg:contents dissolves the wrappers on phones so every card rejoins
    // one flow, and max-lg:order-* keeps the mobile reading order
    // (summary → highlights → periods) the desktop split would otherwise flip.
    <div className="flex flex-col gap-4 font-detail lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
      {/* Trip summary ⇄ Admin Review — ONE card, two faces. The FLIP CONTROL
          is the Review/Summary pill in the header, NOT the card (user call):
          the faces hold their own controls (the delete action, links), and a
          card-wide tap target swallowed those or turned the card over
          mid-read. Both faces stay grid-stacked in every mode, so the card's
          height is always the taller face and nothing jumps. */}
      <div className="max-lg:contents lg:space-y-4">
      <motion.div className="select-none max-lg:order-1">
        {flipping || teasing ? (
          <div style={{ perspective: 1200 }}>
            <motion.div
              initial={{ rotateY: flipped ? (flipping ? 0 : 180) : flipping ? 180 : 0 }}
              animate={
                teasing && !flipping
                  ? // Tease: tilt a few degrees and spring back
                    { rotateY: flipped ? [180, 168, 180] : [0, -12, 0] }
                  : { rotateY: flipped ? 180 : 0 }
              }
              transition={
                teasing && !flipping
                  ? { duration: 0.9, ease: 'easeInOut' }
                  : { duration: 0.55, ease: [0.45, 0, 0.55, 1] }
              }
              onAnimationComplete={() => {
                setFlipping(false)
                setTeasing(false)
              }}
              style={{ transformStyle: 'preserve-3d' }}
              className="grid"
            >
              <section className={`${faceBase} ${frontSkin} [backface-visibility:hidden]`}>{frontContent}</section>
              <section className={`${faceBase} ${backSkin} [backface-visibility:hidden] [transform:rotateY(180deg)]`}>
                {backContent}
              </section>
            </motion.div>
          </div>
        ) : (
          /* At rest: flat, no transforms, no layers — sharp text. */
          <div className="grid">
            <section className={`${faceBase} ${frontSkin} ${flipped ? 'invisible' : ''}`}>{frontContent}</section>
            <section className={`${faceBase} ${backSkin} ${flipped ? '' : 'invisible'}`}>{backContent}</section>
          </div>
        )}
      </motion.div>
      {/* Travel periods — authored V3 overview data (recommended + available),
            in the panel's card language: cream sub-blocks inside a white card. */}
          {(recPeriods.length > 0 || availPeriod) && (
          <section className="rounded-3xl border border-zen-black/10 bg-white p-5 shadow-sm max-lg:order-3">
            <h3 className="text-lg font-extrabold tracking-tight text-zen-black">Travel Periods</h3>
            <div className="mt-3 space-y-3">
              {recPeriods.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-basel-brick">
                    <CalendarCheck className="size-3.5" strokeWidth={2.25} />
                    Recommended · ช่วงแนะนำ
                  </p>
                  {/* Each window = a collapsible cream row (dates up front,
                      area details behind a tap) */}
                  <div className="mt-1.5 space-y-2">
                    {recPeriods.map((p, i) => (
                      <PeriodBlock key={i} primary={p.primary} details={p.details} popular={p.popular} />
                    ))}
                  </div>
                </div>
              )}
              {availPeriod && (
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-graphite/80">
                    <CalendarDays className="size-3.5" strokeWidth={2.25} />
                    Available · เปิดให้เที่ยว
                  </p>
                  <div className="mt-1.5 rounded-2xl bg-briefing-cream p-3">
                    <p className="text-sm font-semibold text-zen-black">{availPeriod.primary}</p>
                    {availPeriod.details?.trim() && <DetailLines text={availPeriod.details} />}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <div className="max-lg:contents lg:space-y-4">
        {/* Highlights card — day by day (derived from activity priorities) */}
          {dayHighlights.length > 0 && (
          <section className="rounded-3xl border border-zen-black/10 bg-white p-5 shadow-sm max-lg:order-2">
            {/* The pencil opens the full itinerary editor — the summary pills edit
                one fact each, this edits the plan itself. Present only when the
                caller supplied a destination (saved trips), so /discover and the
                admin preview show a bare heading. */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold tracking-tight text-zen-black">Day Highlights</h3>
              {editItineraryHref && (
                <Link
                  href={editItineraryHref}
                  aria-label="แก้ไขแผนการเดินทาง · Edit itinerary"
                  className="group grid size-8 shrink-0 place-items-center rounded-full bg-briefing-cream text-graphite/50 transition-colors hover:bg-basel-brick hover:text-white"
                >
                  <Pencil className="size-3.5" strokeWidth={2.5} />
                </Link>
              )}
            </div>
            {/* Cream ticket rows — Ocean day badge + category emoji + names.
                Tappable: jumps to that day in the Itinerary tab. */}
            <ul className="mt-3 space-y-2">
                {dayHighlights.map((h) => (
                <li key={h.day}>
                  <button
                    type="button"
                    onClick={() => onDayTap?.(h.day)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-briefing-cream px-3 py-2.5 text-left transition-colors hover:bg-basel-brick/10"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zen-black text-xs font-bold text-white">
                      {h.day}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-zen-black">
                      {h.emoji && <span className="mr-1.5">{h.emoji}</span>}
                      {h.names.join(' · ') || '—'}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-graphite/40" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {/* Destructive action LAST — below every fact about the trip, so it can
          never be hit on the way to something else.

          max-lg:order-4 is load-bearing: its siblings carry explicit order-1/2/3
          for the mobile flow, and an unordered flex child defaults to 0 — which
          silently floated Delete to the TOP of the page, directly under the
          tabs. lg:col-span-2 keeps it spanning both columns on desktop. Red is the codebase's
          established destructive vocabulary (ConfirmDialog's danger tone), not
          a UI accent; the caller shows the confirm. */}
      {onDeleteTrip && (
        <button
          type="button"
          onClick={onDeleteTrip}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border border-red-200 bg-white py-3.5 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50 max-lg:order-4 lg:col-span-2"
        >
          <Trash2 className="size-4" strokeWidth={2.25} aria-hidden />
          ลบทริปนี้ · Delete this trip
        </button>
      )}
    </div>
  )
}

/** Admin Review lines — a trailing EMOJI RUN is wrapped nowrap so a line
 *  break moves the whole cluster down together instead of splitting it
 *  (🚗 on one line, 🏔️ on the next reads broken). */
const TRAILING_EMOJI = /^(.*?)\s*((?:\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*\s*)+)$/u
function NoteLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const m = line.match(TRAILING_EMOJI)
        return (
          <p key={i}>
            {m ? (
              <>
                {m[1]} <span className="whitespace-nowrap">{m[2].trim()}</span>
              </>
            ) : (
              line
            )}
          </p>
        )
      })}
    </>
  )
}

/** Flip affordance — labeled corner chip ("↻ Review"): icon-only proved too
 *  subtle; words name the interaction AND what's on the back. */
/** The flip control. It IS the button now — the card itself no longer flips
 *  on tap, so the links, chips and accordions inside a face are safe to use
 *  without the card turning over under you. */
function FlipHint({ label, dark, onClick }: { label: string; dark: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === 'Review' ? 'ดูรีวิวแอดมิน · Show admin review' : 'ดูสรุปทริป · Show trip summary'}
      className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        dark
          ? 'bg-white/10 text-briefing-cream/70 hover:bg-white/20 hover:text-briefing-cream'
          : 'bg-briefing-cream text-graphite/70 hover:bg-basel-brick/10 hover:text-basel-brick'
      }`}
    >
      <RefreshCw className="size-3" strokeWidth={2.25} />
      {label}
    </button>
  )
}

// ── Itinerary tab — day timelines (chips live in the modal's tab block) ─────

/** Meal-slot options — drag-left/right carousel (embla, like the original
 *  ChoiceCarousel). The traveler's pick (else the admin's ⭐) is REORDERED to
 *  the front instead of scrolled to via startIndex: start-scrolling onto a
 *  late option left the row mid-scroll with stray gaps at both ends. */
function ChoiceOptions({ options }: { options: OptionCard[] }) {
  const selectedIdx = options.findIndex((o) => o.selected)
  const recommendedIdx = options.findIndex((o) => o.recommended)
  const firstIdx = selectedIdx >= 0 ? selectedIdx : recommendedIdx >= 0 ? recommendedIdx : 0
  const ordered = firstIdx > 0 ? [options[firstIdx], ...options.filter((_, i) => i !== firstIdx)] : options
  const [emblaRef] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps' })

  return (
    <div className="mt-2 overflow-hidden" ref={emblaRef}>
      <div className="flex gap-2">
        {ordered.map((o, i) => (
          <div
            key={i}
            className={`flex min-w-0 flex-[0_0_88%] flex-col rounded-xl border p-3 sm:flex-[0_0_60%] ${
              o.selected
                ? 'border-basel-brick bg-basel-brick/5'
                : o.recommended
                  ? 'border-zen-black/10 bg-briefing-cream'
                  : 'border-zen-black/10 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug text-zen-black">{o.name}</p>
              {o.recommended && <span className="shrink-0 text-[11px] font-bold text-basel-brick">⭐ แนะนำ</span>}
            </div>
            {/* Restaurant detail — the option's authored description */}
            {o.notes?.trim() && <p className="mt-1 text-xs leading-relaxed text-graphite/70">{o.notes}</p>}
            {/* Cost + link chips share one line (duration lives at slot level) */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {o.cost && <p className="text-xs text-graphite/60">{o.cost}</p>}
              <LinkChips mapUrl={o.mapUrl} walkingUrl={o.walkingUrl} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineItem({ row, isLast }: { row: Row; isLast: boolean }) {
  const rail = (marker: React.ReactNode) => (
    <span className="relative flex justify-center">
      {!isLast && <span className="absolute top-4 h-[calc(100%-0.5rem)] w-0.5 rounded-full bg-basel-brick/25" aria-hidden />}
      {marker}
    </span>
  )

  // LOGISTICS — muted connector ("how you move"), per the old ItineraryView
  // logic: emoji chip on the rail, one quiet line, no destination styling.
  if (row.isLogistics) {
    return (
      <li className="relative grid grid-cols-[3.25rem_1.5rem_1fr]">
        <span className="pt-0.5 text-right text-sm font-medium text-graphite/60">{row.time || ''}</span>
        {rail(
          <span
            className="relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-zen-black/[0.06] text-[10px] leading-none"
            aria-hidden
          >
            {row.emoji ?? '🚃'}
          </span>,
        )}
        <div className={`pl-3 ${isLast ? 'pb-1' : 'pb-5'}`}>
          {/* Same size + color as activity titles — weight alone (regular vs
              bold) tells transport apart from destinations. */}
          <p className="leading-snug text-zen-black">{row.name}</p>
          {row.duration && <p className="mt-0.5 text-xs text-graphite/60">{row.duration}</p>}
        </div>
      </li>
    )
  }

  // CHOICE (meal slot) — options carousel; time in the left column like
  // every other slot.
  if (row.choice) {
    return (
      <li className="relative grid grid-cols-[3.25rem_1.5rem_1fr]">
        <span className="pt-0.5 text-right text-sm font-medium text-graphite">{row.time || ''}</span>
        {rail(
          <span className="relative z-10 mt-1.5 size-3 shrink-0 rounded-full bg-basel-brick ring-4 ring-basel-brick/20" aria-hidden />,
        )}
        <div className={`min-w-0 pl-3 ${isLast ? 'pb-1' : 'pb-6'}`}>
          <p className="font-semibold leading-snug text-zen-black">{row.choice.label}</p>
          {/* Slot-level duration (from the picked option) — cards stay lighter */}
          {row.duration && <p className="mt-0.5 text-xs text-graphite/60">{row.duration}</p>}
          <ChoiceOptions options={row.choice.options} />
        </div>
      </li>
    )
  }

  // Regular activity — the destination row.
  return (
    <li className="relative grid grid-cols-[3.25rem_1.5rem_1fr]">
      {/* Time */}
      <span className="pt-0.5 text-right text-sm font-medium text-graphite">{row.time || 'XX:XX'}</span>
      {rail(
        <span className="relative z-10 mt-1.5 size-3 shrink-0 rounded-full bg-basel-brick ring-4 ring-basel-brick/20" aria-hidden />,
      )}
      {/* Content */}
      <div className={`flex items-start justify-between gap-3 pl-3 ${isLast ? 'pb-1' : 'pb-6'}`}>
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-zen-black">{row.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="text-xs text-graphite/70">{row.duration || 'XX h'}</p>
            <LinkChips mapUrl={row.mapUrl} walkingUrl={row.walkingUrl} />
          </div>
        </div>
      </div>
    </li>
  )
}

export function ItineraryPanel({ itinerary, sel }: { itinerary: AnyItinerary; sel: DaySel }) {
  const days = getRenderDays(itinerary)
  const shown = sel === 'all' ? days : days.filter((d) => d.day === sel)
  // "All" view: per-day accordion, default CLOSED — the pre-redesign logic
  // (multiple days can be open; toggling one never collapses the others).
  // A specific day chip always shows that day expanded.
  const [openDays, setOpenDays] = useState<Set<number>>(new Set())
  const toggleDay = (d: number) =>
    setOpenDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  return (
    <div className="space-y-3 font-detail">
      {shown.map((day) => {
        const rows = dayRows(day)
        const isOpen = sel !== 'all' || openDays.has(day.day)
        const header = (
          <>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zen-black text-xs font-bold text-white">
              {day.day}
            </span>
            <div className="min-w-0 flex-1">
              {/* The HIGHLIGHT trails "Day N" on the same line (ต่อท้าย) — the
                  same text the Overview's Day Highlights list shows, so the two
                  tabs agree on what a day is about. Suppressed when it would
                  merely repeat the day's name below. */}
              <h2 className="text-base font-extrabold tracking-tight text-zen-black">
                Day {day.day}
                {day.highlight && day.highlight !== day.location && (
                  <span className="ml-2 text-sm font-semibold text-basel-brick">{day.highlight}</span>
                )}
              </h2>
              {/* The day's authored NAME (V3 day.name) */}
              {day.location && <p className="truncate text-sm text-graphite/70">{day.location}</p>}
            </div>
          </>
        )
        return (
          // Each day is a card, matching the panel's card vocabulary. Read-only
          // preview: no dates, no editor actions (those live in the trip editor).
          <section key={day.day} className="overflow-hidden rounded-3xl border border-zen-black/10 bg-white shadow-sm">
            {sel === 'all' ? (
              <button
                type="button"
                onClick={() => toggleDay(day.day)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-briefing-cream/60"
              >
                {header}
                <ChevronRight
                  className={`size-4 shrink-0 text-graphite/50 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  aria-hidden
                />
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4">{header}</div>
            )}

            {/* Timeline — unrolls inside the card */}
            {isOpen && (
              <div className="px-4 pb-4">
                <ul className="pt-1">
                  {rows.map((row, i) => (
                    <TimelineItem key={i} row={row} isLast={i === rows.length - 1} />
                  ))}
                </ul>
                {rows.length === 0 && (
                  <p className="text-sm text-graphite/60">{day.free ? 'วันว่าง · Free day' : 'XX'}</p>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
