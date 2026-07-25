'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowRight, Search, SlidersHorizontal, X, ChevronDown, Check } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { evaluateTrip } from '@/lib/availability'
import DateRangePicker from '@/app/components/DateRangePicker'
import { type PlanTemplate } from '@/app/components/PlanCard'
import TripDeck, { TripCard, DECK_CARD_W, DECK_CARD_H } from '@/app/components/TripDeck'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates'

/**
 * TripSearchSection — the ENTIRE "Ready-to-go Trips" experience as one shared
 * unit: title row + search pill + filter modal (destination multi-select,
 * travel dates, season quick-picks, flexibility) + removable filter chips +
 * the boarding-pass cards (TripDeck on mobile / TripCard row on desktop) +
 * the trip preview/duplicate modal.
 *
 * Used by BOTH the home page (newest 3, "View all" links) and /discover
 * (full catalog, ?trip= deep links) — designed for the dark Midnight
 * background on both. Change it once, both pages follow.
 */

// Season quick-picks: one tap PRE-FILLS the calendar with that season's
// upcoming window — season is not a separate filter, the date range is the
// single source of truth.
const SEASONS = [
  { key: 'Winter', emoji: '❄️', months: 'Dec – Feb' },
  { key: 'Spring', emoji: '🌸', months: 'Mar – May' },
  { key: 'Summer', emoji: '☀️', months: 'Jun – Aug' },
  { key: 'Autumn', emoji: '🍁', months: 'Sep – Nov' },
] as const
// Top tourist prefectures (Thai-market recognition order). Edit freely — the
// dropdown self-prunes to prefectures that actually have published trips.
const TOP_PREFECTURES = ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido', 'Fukuoka', 'Okinawa', 'Nagano', 'Nara', 'Yamanashi', 'Gifu']
// ± flex widens the picked window by N days on EACH side, so a slightly-off
// availability window still matches. Default ตรงเป๊ะ (0).
const FLEX_CHIPS = [
  { value: 0, label: 'ตรงเป๊ะ' },
  { value: 3, label: '±3 วัน' },
  { value: 7, label: '±7 วัน' },
  { value: 12, label: '±12 วัน' },
] as const

/** Custom MULTI-SELECT dropdown for the filter modal (Cloud theme). Options can
 *  carry a `sub` line so labels never truncate. Picking an option toggles it
 *  (the list stays open for more picks); the '' option means "All" and is
 *  active when nothing is selected.
 *  (Native <select> was tried: the OS-drawn open list can't be styled.) */
function FilterSelect({
  label,
  display,
  open,
  onToggle,
  options,
  values,
  onPick,
}: {
  label: string
  display: string
  open: boolean
  onToggle: () => void
  options: { value: string; label: string; sub?: string; disabled?: boolean }[]
  values: string[]
  onPick: (v: string) => void
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-graphite/70">{label}</p>
      <div className="relative mt-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-full border border-zen-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-zen-black transition-colors hover:border-basel-brick/50"
        >
          <span className="truncate">{display}</span>
          <ChevronDown
            className={`size-4 shrink-0 text-graphite/60 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-zen-black/10 bg-white shadow-xl shadow-black/15">
            {options.map((o) => {
              const active = o.value === '' ? values.length === 0 : values.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => onPick(o.value)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                    o.disabled ? 'cursor-not-allowed' : active ? 'bg-basel-brick/10' : 'hover:bg-zen-black/5'
                  }`}
                >
                  {/* Leading CHECKBOX (not a trailing tick) — the visual cue
                      that several options can be on at once. The '' (All) row
                      is a state, not a choice, so it keeps the plain tick. */}
                  {o.value !== '' && (
                    <span
                      aria-hidden
                      className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                        active
                          ? 'border-basel-brick bg-basel-brick'
                          : o.disabled
                            ? 'border-zen-black/15'
                            : 'border-zen-black/25'
                      }`}
                    >
                      {active && <Check className="size-3 text-white" strokeWidth={3} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${
                        o.disabled
                          ? 'font-medium text-graphite/35'
                          : active
                            ? 'font-bold text-zen-black'
                            : 'font-medium text-graphite'
                      }`}
                    >
                      {o.label}
                    </span>
                    {o.sub && (
                      <span className={`block text-[11px] ${o.disabled ? 'text-graphite/35' : 'text-graphite/60'}`}>
                        {o.sub}
                      </span>
                    )}
                  </span>
                  {o.value === '' && active && (
                    <Check className="size-4 shrink-0 text-basel-brick" strokeWidth={2.5} aria-hidden />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** Short Thai date for the removable filter chip (e.g. "17 ต.ค."). */
function fmtChipDate(d: Date): string {
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysDate(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + n)
  return r
}

/** Upcoming calendar window for a season quick-pick — this year's occurrence
 *  while it's still running (start clamped to today), else next year's.
 *  Winter wraps the year boundary (Dec → end of Feb). */
function seasonRange(key: string): DateRange | undefined {
  const spans: Record<string, [number, number]> = { Spring: [2, 4], Summer: [5, 7], Autumn: [8, 10], Winter: [11, 13] }
  const span = spans[key]
  if (!span) return undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y = today.getFullYear()
  let from = new Date(y, span[0], 1)
  let to = new Date(y, span[1] + 1, 0) // day 0 of the next month = the span's last day
  if (to < today) {
    from = new Date(y + 1, span[0], 1)
    to = new Date(y + 1, span[1] + 1, 0)
  }
  if (from < today) from = today // mid-season → start today, not in the past
  return { from, to }
}

export default function TripSearchSection({
  title,
  subtitle,
  callbackUrl,
  defaultCount,
  viewAllHref,
  openFromQueryParam = false,
  headingTag: HeadingTag = 'h2',
}: {
  title: string
  subtitle: string
  /** Sign-in bounce + saved-templates return URL ('/' or '/discover'). */
  callbackUrl: string
  /** With NO filter active, show only the newest N (home). Omit → show ALL. */
  defaultCount?: number
  /** Render the desktop + mobile "View all" links pointing here (home only). */
  viewAllHref?: string
  /** Read ?trip=CODE after load and auto-open that trip (shared links). */
  openFromQueryParam?: boolean
  /** 'h1' on pages where this is the main heading (/discover). */
  headingTag?: 'h1' | 'h2'
}) {
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) ?? null : null
  const { savedIds, pending, toggleHeart } = useSavedTemplates(callbackUrl)

  const [query, setQuery] = useState('')
  // Multi-select destinations — a trip matches if it touches ANY selected
  // prefecture (OR), so adding picks widens results instead of zeroing them.
  const [destList, setDestList] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  // Destination dropdown open state (the only dropdown in the modal).
  const [ddOpen, setDdOpen] = useState<'dest' | null>(null)
  // Season quick-pick — NOT a separate filter: it pre-fills the calendar range
  // (the dates are the single source of truth). Cleared when the calendar is
  // hand-edited, so the pill highlight never lies about the range.
  const [seasonPick, setSeasonPick] = useState<string | null>(null)
  // Travel window. A single picked day = a one-day window (endD falls back).
  const [range, setRange] = useState<DateRange | undefined>()
  const [flex, setFlex] = useState(0) // ± days widening; only meaningful with a window
  const startD = range?.from ?? null
  const endD = range?.to ?? range?.from ?? null
  // Flex-widened window used for matching (raw dates still feed the duplicate flow).
  const effStart = startD ? addDaysDate(startD, -flex) : null
  const effEnd = endD ? addDaysDate(endD, flex) : null
  const activeFilterCount = (destList.length ? 1 : 0) + (startD ? 1 : 0)

  // Auto-collapse the filter modal if the page scrolls far from the search bar
  // (the scrim doesn't lock background scroll — desktop wheel keeps working).
  useEffect(() => {
    if (!filterOpen) return
    const startY = window.scrollY
    const onScroll = () => {
      if (Math.abs(window.scrollY - startY) > 250) setFilterOpen(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [filterOpen])

  // Destinations: ALL top tourist prefectures are listed; ones without a
  // published trip are disabled + "Coming soon" (markets the roadmap without
  // letting anyone filter into an empty result).
  const availableDest = new Set(
    TOP_PREFECTURES.filter((p) => templates.some((t) => t.title.toLowerCase().includes(p.toLowerCase()))),
  )
  const q = query.trim().toLowerCase()
  const filtering = !!(q || destList.length || startD)
  // No filter → newest `defaultCount` (home) or the whole catalog (/discover).
  const base = defaultCount ? [...templates].slice(-defaultCount).reverse() : [...templates].reverse()
  const shown = filtering
    ? [...templates]
        .reverse() // newest first
        .filter((t) => {
          if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false
          if (destList.length && !destList.some((d) => t.title.toLowerCase().includes(d.toLowerCase()))) return false
          if (effStart && effEnd && !evaluateTrip(t.availability, effStart, effEnd, t.totalDays).matches) return false
          return true
        })
    : base

  useEffect(() => {
    let active = true
    fetch('/api/templates')
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => {
        if (!active) return
        const list: PlanTemplate[] = d.templates ?? []
        setTemplates(list)
        // Shared link (?trip=TKY-001): open that trip's preview on arrival.
        // Read via window (not useSearchParams — that needs a Suspense boundary).
        if (openFromQueryParam) {
          const code = new URLSearchParams(window.location.search).get('trip')
          if (code) {
            const hit = list.find((t) => t.shareCode?.toLowerCase() === code.toLowerCase())
            if (hit) setSelectedId(hit.id)
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setTripsLoading(false) })
    return () => { active = false }
  }, [openFromQueryParam])

  const emptyText = filtering
    ? 'ไม่พบทริปที่ตรงเงื่อนไข · No matching trips'
    : 'ยังไม่มีแพลนในขณะนี้ · No trips yet.'

  return (
    <>
      <div className="mb-10">
        <div className="md:flex md:items-center md:gap-14">
          <div className="shrink-0">
            <HeadingTag className="font-headline font-bold text-3xl md:text-5xl tracking-tight">{title}</HeadingTag>
            <p className="mt-2.5 text-briefing-cream/70 font-sans">{subtitle}</p>
          </div>
          {/* Search — desktop: same row, adjacent to the title (row gap only,
              no auto-centering); View all takes the right edge via ml-auto.
              Mobile: full-width below the title. Filter button INSIDE the
              field (far right); the chips live below the field. */}
          <div className="relative mt-5 md:mt-0 w-full max-w-lg md:max-w-4xl">
            <div className="group relative">
              {/* Ocean bloom on focus — the hero button's halo vocabulary
                  (same radial + rgba), answering focus instead of hover. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-4 opacity-0 transition-opacity duration-[350ms] ease-out group-focus-within:opacity-100"
                style={{ background: 'radial-gradient(closest-side, rgba(91,136,178,0.30), transparent 72%)' }}
              />
              {/* z-10: the input's backdrop-blur creates a stacking context
                  that otherwise paints OVER this earlier-DOM icon. */}
              <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-briefing-cream/40" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาทริป · Find a trip…"
                className="w-full rounded-full border border-white/15 bg-white/10 py-3 pl-11 pr-12 text-sm text-briefing-cream outline-none backdrop-blur-sm transition-[border-color,box-shadow] duration-[350ms] placeholder:text-briefing-cream/40 focus:border-basel-brick/60 focus:shadow-[0_0_24px_rgba(91,136,178,0.22)]"
              />
              <button
                type="button"
                onClick={() => {
                  setFilterOpen((o) => !o)
                  setDdOpen(null)
                }}
                aria-expanded={filterOpen}
                aria-label="ตัวกรอง · Filters"
                className={`absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full transition-colors ${
                  filterOpen ? 'bg-briefing-cream text-zen-black' : 'text-briefing-cream/60 hover:bg-white/10 hover:text-briefing-cream'
                }`}
              >
                <SlidersHorizontal className="size-4" strokeWidth={2.25} />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-basel-brick text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active-filter bubbles — each removable ONLY via its × */}
            {activeFilterCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {destList.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 py-1 pl-3 pr-1.5 text-xs font-semibold text-briefing-cream backdrop-blur-sm"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => setDestList((l) => l.filter((x) => x !== d))}
                      aria-label={`Remove ${d}`}
                      className="grid size-5 place-items-center rounded-full text-briefing-cream/60 transition-colors hover:bg-white/15 hover:text-briefing-cream"
                    >
                      <X className="size-3" strokeWidth={2.5} aria-hidden />
                    </button>
                  </span>
                ))}
                {startD && (
                  <span className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 py-1 pl-3 pr-1.5 text-xs font-semibold text-briefing-cream backdrop-blur-sm">
                    {/* A season quick-pick reads as the season, not raw dates */}
                    {seasonPick
                      ? `${SEASONS.find((s) => s.key === seasonPick)?.emoji ?? ''} ${seasonPick}`
                      : `📅 ${fmtChipDate(startD)}${endD && endD.getTime() !== startD.getTime() ? ` – ${fmtChipDate(endD)}` : ''}`}
                    <button
                      type="button"
                      onClick={() => { setRange(undefined); setFlex(0); setSeasonPick(null) }}
                      aria-label="Remove dates"
                      className="grid size-5 place-items-center rounded-full text-briefing-cream/60 transition-colors hover:bg-white/15 hover:text-briefing-cream"
                    >
                      <X className="size-3" strokeWidth={2.5} aria-hidden />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
          {viewAllHref && (
            /* Desktop: View all — right edge of the same row, centered
               vertically against the title + subtitle block */
            <Link
              href={viewAllHref}
              className="group shrink-0 hidden md:flex md:ml-auto items-center gap-2 font-headline font-bold uppercase tracking-widest text-sm text-briefing-cream/80 hover:text-basel-brick transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* Filter MODAL — overlays the whole page (the deck cards carry their
            own z-indexes, so any in-page popover loses the paint war). */}
        <AnimatePresence>
          {filterOpen && (
            <motion.div
              key="filter-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              // Solid-enough scrim, NO backdrop-blur: backdrop-filter on the
              // same element as overflow-y-auto renders a faint seam line in
              // Chrome. 0.92 Midnight hides the page content without the blur.
              style={{ backgroundColor: 'rgba(10,27,51,0.92)' }}
              // items-start + top padding (not centered): the date picker opens
              // DOWNWARD from inside the card, so the card sits a bit above
              // center to leave the calendar viewport room. overflow-y-auto
              // keeps short screens usable (scrim scrolls, nothing clips).
              className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto px-4 pt-[max(2rem,16vh)] pb-6"
              onClick={(e) => {
                if (e.target === e.currentTarget) setFilterOpen(false)
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                // Cloud card — solid briefing-cream (glass went muddy over the
                // dark scrim; a filter panel wants clarity).
                className="relative w-full max-w-sm rounded-3xl bg-briefing-cream p-5 font-detail shadow-2xl shadow-black/30"
              >
                <h3 className="text-lg font-extrabold tracking-tight text-zen-black">What&apos;s your choice?</h3>
                {/* right-8 = card p-5 (20px) + Done's px-3 text inset (12px),
                    so Reset's right text edge sits exactly over Done's. */}
                <button
                  type="button"
                  onClick={() => {
                    setDestList([])
                    setSeasonPick(null)
                    setRange(undefined)
                    setFlex(0)
                  }}
                  className="absolute right-8 top-[30px] text-xs font-semibold text-graphite/70 underline-offset-2 hover:text-basel-brick hover:underline"
                >
                  Reset
                </button>

                {/* Destination — full-width, same pill run as the date field
                    (Season became the quick-pick pills below that pre-fill the
                    calendar). */}
                <div className="mt-4">
                  <FilterSelect
                    label="Destination · จังหวัด"
                    // Full list joined — the trigger's `truncate` clips with …
                    display={destList.length === 0 ? 'ทั้งหมด · All' : destList.join(' / ')}
                    open={ddOpen === 'dest'}
                    onToggle={() => setDdOpen(ddOpen === 'dest' ? null : 'dest')}
                    values={destList}
                    options={[
                      { value: '', label: 'ทั้งหมด · All' },
                      // Live prefectures first, then coming-soon — each group alphabetical.
                      ...[...TOP_PREFECTURES]
                        .sort(
                          (a, b) =>
                            Number(!availableDest.has(a)) - Number(!availableDest.has(b)) || a.localeCompare(b),
                        )
                        .map((p) => ({
                          value: p,
                          label: p,
                          disabled: !availableDest.has(p),
                          sub: availableDest.has(p) ? undefined : 'เร็วๆ นี้ · Coming soon',
                        })),
                    ]}
                    onPick={(v) => {
                      // '' = All → clear and close; a prefecture toggles and
                      // the list STAYS OPEN for more picks.
                      if (!v) {
                        setDestList([])
                        setDdOpen(null)
                        return
                      }
                      setDestList((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]))
                    }}
                  />
                </div>

                {/* Travel window — evaluateTrip availability matching; the
                    picked dates also pre-fill the duplicate flow's date step. */}
                <div className="mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-graphite/70">
                    Travel dates · ช่วงวันเดินทาง
                  </p>
                  <div className="mt-2">
                    {/* Hand-editing the calendar unlinks the season pill — the
                        highlight must never lie about the range. */}
                    <DateRangePicker
                      value={range}
                      onChange={(r) => {
                        setRange(r)
                        setSeasonPick(null)
                      }}
                    />
                  </div>

                  {/* Season quick-picks — one tap fills the calendar with that
                      season's upcoming window; tap again to clear. Single-select
                      on purpose: two non-adjacent seasons can't form one range.
                      2×2 grid of THIN single-line pills. */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {SEASONS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          if (seasonPick === s.key) {
                            setSeasonPick(null)
                            setRange(undefined)
                            setFlex(0)
                          } else {
                            setSeasonPick(s.key)
                            setRange(seasonRange(s.key))
                          }
                        }}
                        // Left-anchored columns: everything starts at the same
                        // px-3 inset in all four pills; the 6-letter season
                        // names are near-equal width, so the months line up too.
                        // leading-none + items-center + a 1px optical nudge
                        // handle the vertical.
                        className={`flex items-center rounded-full border px-3 py-1.5 leading-none text-sm font-semibold whitespace-nowrap transition-colors ${
                          seasonPick === s.key
                            ? 'border-basel-brick bg-basel-brick text-white'
                            : 'border-zen-black/15 bg-white text-zen-black hover:border-basel-brick/50'
                        }`}
                      >
                        <span aria-hidden className="mr-1.5 text-xs">{s.emoji}</span>
                        {s.key}
                        <span className={`ml-3 translate-y-[1px] text-[10px] font-medium ${seasonPick === s.key ? 'text-white/85' : 'text-graphite/80'}`}>
                          {s.months}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Flexibility — widens the match by ± days on each side.
                      Always shown, but disabled until a window is picked. */}
                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-graphite/70">
                      Flexibility · ยืดหยุ่น
                      {!startD && (
                        <span className="ml-1.5 font-medium normal-case tracking-normal text-graphite/45">
                          (เลือกวันก่อน · choose the date first)
                        </span>
                      )}
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {FLEX_CHIPS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!startD}
                          onClick={() => setFlex(opt.value)}
                          className={`rounded-full border px-1 py-1.5 leading-none text-center text-sm font-semibold whitespace-nowrap transition-colors ${
                            !startD
                              ? 'cursor-not-allowed border-zen-black/15 bg-white text-zen-black'
                              : flex === opt.value
                                ? 'border-basel-brick bg-basel-brick text-white'
                                : 'border-zen-black/15 bg-white text-zen-black hover:border-basel-brick/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-basel-brick transition-colors hover:bg-basel-brick/10"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile — swipeable deck (design + motion ported from the Kimi build) */}
      <div className="md:hidden">
        {tripsLoading ? (
          <div
            style={{ width: DECK_CARD_W, height: DECK_CARD_H }}
            className="mx-auto animate-pulse rounded-[20px] border border-white/10 bg-white/5"
          />
        ) : shown.length > 0 ? (
          <TripDeck
            key={shown.map((t) => t.id).join('|')}
            templates={shown}
            savedIds={savedIds}
            pending={pending}
            onOpen={(id) => setSelectedId(id)}
            onHeart={(id, e) => toggleHeart(id, e)}
          />
        ) : (
          <p className="text-center text-briefing-cream/50 font-sans">{emptyText}</p>
        )}
        {viewAllHref && (
          /* Mobile View all — AFTER the deck: browse cards → want more → the
             natural next step. */
          <Link
            href={viewAllHref}
            className="group mx-auto mt-6 flex w-fit items-center gap-2 font-headline font-bold uppercase tracking-widest text-xs text-briefing-cream/70 transition-colors hover:text-basel-brick"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>

      {/* Desktop — same boarding-pass card as the mobile deck (shared
          CardFace), laid out as a wrapping row with a hover lift. */}
      <div className="hidden md:flex flex-wrap justify-center gap-6 md:gap-8">
        {tripsLoading
          ? Array.from({ length: defaultCount ?? 4 }).map((_, i) => (
              <div
                key={i}
                style={{ width: DECK_CARD_W, height: DECK_CARD_H }}
                className="animate-pulse rounded-[20px] border border-white/10 bg-white/5"
              />
            ))
          : shown.length > 0
            ? shown.map((tpl) => (
                <TripCard
                  key={tpl.id}
                  tpl={tpl}
                  saved={savedIds.has(tpl.id)}
                  isPending={pending.has(tpl.id)}
                  onOpen={(id) => setSelectedId(id)}
                  onHeart={(id, e) => toggleHeart(id, e)}
                />
              ))
            : (
              <p className="w-full text-center text-briefing-cream/50 font-sans">{emptyText}</p>
            )}
      </div>

      {/* Preview + duplicate modal — the picked travel window pre-fills its
          date step. */}
      <PlanPreviewModal
        template={selectedTemplate}
        defaultStartDate={startD ? toISODate(startD) : ''}
        defaultEndDate={endD ? toISODate(endD) : ''}
        callbackUrl={callbackUrl}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}
