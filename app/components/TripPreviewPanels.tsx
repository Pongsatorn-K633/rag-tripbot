'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import useEmblaCarousel from 'embla-carousel-react'
import { CalendarDays, CalendarCheck, MapPin, ChevronRight, RefreshCw, Footprints } from 'lucide-react'
import { safeHref } from '@/lib/url'
import JapanIcon from '@/app/components/JapanIcon'
import type { AnyItinerary, Choice } from '@/lib/itinerary-types'
import { getRenderDays, isV3, CATEGORY_EMOJI } from '@/lib/trips/itinerary-model'
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

// ── Overview tab — Trip summary + Highlights + Admin Review ────────────────

export function OverviewPanel({
  itinerary,
  tripDays,
  onDayTap,
}: {
  itinerary: AnyItinerary
  tripDays: number
  /** Tap a highlight row → open that day in the Itinerary tab. */
  onDayTap?: (day: number) => void
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
  const dayHighlights = v3
    ? v3.days.map((d) => {
        const acts = (d.activities ?? []).filter((a) => a.slot?.startsWith('Activity'))
        const must = acts.filter((a) => a.priority === 'Must')
        const rec = acts.filter((a) => a.priority === 'Recommend')
        const picks = (must.length ? must : rec.length ? rec : acts).slice(0, 2)
        // Authored day.highlight wins; otherwise derive from priorities.
        const authored = d.highlight?.th || d.highlight?.en
        return {
          day: d.day,
          names: authored ? [authored] : picks.map((a) => a.name?.th || a.name?.en || '').filter(Boolean),
          emoji: (picks[0]?.category && CATEGORY_EMOJI[picks[0].category]) || null,
        }
      })
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

  const [flipped, setFlipped] = useState(false)
  // 3D machinery mounts ONLY while flipping: a permanent perspective/preserve-3d
  // context rasterizes the card into a GPU layer at rest and the text goes soft
  // (same disease as the old will-change blur). At rest the card is a plain flat
  // element — pixel-sharp by construction.
  const [flipping, setFlipping] = useState(false)

  function toggleFlip() {
    if (flipping) return
    setFlipping(true)
    setFlipped((f) => !f)
  }

  const faceBase = 'flex flex-col rounded-3xl [grid-area:1/1]'
  const frontSkin = 'border border-zen-black/10 bg-white p-5 shadow-sm'
  const backSkin = 'bg-zen-black p-5 shadow-lg shadow-zen-black/25'

  const frontContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-noir">Trip summary</h2>
        <FlipHint dark={false} />
      </div>
      {tagline?.trim() && <p className="mt-0.5 text-sm font-medium text-graphite/70">{tagline}</p>}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl bg-briefing-cream p-3 text-center">
            <Icon className="mx-auto size-5 text-basel-brick" />
            <p className="mt-1.5 text-lg font-extrabold text-zen-black">{value}</p>
            <p className="text-xs font-medium text-graphite/70">{label}</p>
          </div>
        ))}
      </div>
    </>
  )
  const backContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-extrabold tracking-tight text-briefing-cream/90">Admin Review</p>
        <FlipHint dark />
      </div>
      {/* Near-full opacity: this is the pitch, not fine print — and opacity
          dims color EMOJI along with the text, which reads as washed out. */}
      <div className="mt-1.5 text-sm leading-relaxed text-briefing-cream/95">
        <NoteLines text={note?.trim() || 'XX'} />
      </div>
    </>
  )

  return (
    <div className="space-y-4 font-detail">
      {/* Trip summary ⇄ Admin Review — ONE card, two faces; tap to flip.
          Both faces stay grid-stacked in every mode, so the card's height is
          always the taller face and nothing jumps. */}
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'ดูสรุปทริป · Show trip summary' : 'ดูรีวิวแอดมิน · Show admin review'}
        onTap={toggleFlip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleFlip()
          }
        }}
        className="cursor-pointer select-none"
      >
        {flipping ? (
          <div style={{ perspective: 1200 }}>
            <motion.div
              initial={{ rotateY: flipped ? 0 : 180 }}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.55, ease: [0.45, 0, 0.55, 1] }}
              onAnimationComplete={() => setFlipping(false)}
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

      {/* Highlights card — day by day (derived from activity priorities) */}
      {dayHighlights.length > 0 && (
        <section className="rounded-3xl border border-zen-black/10 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-extrabold tracking-tight text-noir">Day Highlights</h3>
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
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-basel-brick text-xs font-bold text-white">
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

      {/* Travel periods — authored V3 overview data (recommended + available),
          in the panel's card language: cream sub-blocks inside a white card. */}
      {(recPeriods.length > 0 || availPeriod) && (
        <section className="rounded-3xl border border-zen-black/10 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-extrabold tracking-tight text-noir">Travel Periods</h3>
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

/** Flip affordance — icon-only corner chip (↻): "this card flips". */
function FlipHint({ dark }: { dark: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-6 shrink-0 place-items-center rounded-full ${
        dark ? 'bg-white/10 text-briefing-cream/70' : 'bg-briefing-cream text-graphite/70'
      }`}
    >
      <RefreshCw className="size-3" strokeWidth={2.25} />
    </span>
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
          <p className="leading-snug text-noir">{row.name}</p>
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
          <p className="font-semibold leading-snug text-noir">{row.choice.label}</p>
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
          <p className="font-semibold leading-snug text-noir">{row.name}</p>
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
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-basel-brick text-xs font-bold text-white">
              {day.day}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold tracking-tight text-noir">Day {day.day}</h2>
              {/* The day's authored NAME (V3 day.name) — the reason to open it */}
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
