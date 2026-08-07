'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowRight, Search, SlidersHorizontal, X, ChevronDown, Check, Map as MapIcon, RotateCcw } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { evaluateTrip } from '@/lib/availability'
import DateRangePicker from '@/app/components/DateRangePicker'
import { type PlanTemplate } from '@/app/components/PlanCard'
import TripDeck, { TripCardCompact, TripCoverflow, DECK_CARD_W, DECK_CARD_H } from '@/app/components/TripDeck'
import PlanPreviewModal from '@/app/components/PlanPreviewModal'
import { useSavedTemplates } from '@/app/hooks/useSavedTemplates'
import JapanMap3D from '@/app/components/JapanMap3D'
import { JAPAN_REGIONS, REGION_PREFECTURES, MAP_LAYERS, SEASON_RAMPS, SEASON_TINTS, type MapLayerId } from '@/lib/japan-regions'

/** The map's layer control — expanding-pill toggle: every option rests as a
 *  bare emoji; the ACTIVE one opens up to emoji + label in a softly filled
 *  pill (no outer frame), collapsing whichever was open before. */
const MAP_LAYER_OPTIONS: readonly { id: MapLayerId; emoji: string; label: string }[] = [
  { id: 'cities', emoji: '🗾', label: 'Cities' },
  { id: 'attractions', emoji: '⛩️', label: 'Attractions' },
  { id: 'sakura', emoji: '🌸', label: 'Sakura' },
  { id: 'autumn', emoji: '🍁', label: 'Autumn' },
  { id: 'ski', emoji: '⛷️', label: 'Ski' },
]

/** The layers whose land is TINTED by timing and that show the legend card. */
type SeasonLayerId = Exclude<MapLayerId, 'cities' | 'attractions'>
const asSeasonLayer = (id: MapLayerId): SeasonLayerId | null =>
  id === 'cities' || id === 'attractions' ? null : id

function MapLayerControls({
  layer,
  onChange,
}: {
  layer: MapLayerId
  onChange: (id: MapLayerId) => void
}) {
  return (
    // GHOST styling, same family as the RegionChip legend (transparent +
    // cream hairlines) — the old solid-cream card was the one opaque element
    // floating on the map panel and read as a different system (user call).
    <div className="inline-flex items-center gap-1">
      {MAP_LAYER_OPTIONS.map((o) => {
        const active = layer === o.id
        return (
          <motion.button
            key={o.id}
            layout
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            aria-label={o.label}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            className={`flex items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 py-1 font-sans text-xs backdrop-blur-sm transition-[border-color,background-color,color] duration-300 ${
              active
                ? 'border-briefing-cream/45 bg-briefing-cream/20 font-semibold text-briefing-cream'
                : 'border-white/15 bg-white/10 text-briefing-cream/70 hover:border-basel-brick/60 hover:text-briefing-cream'
            }`}
          >
            <span className="text-[14px] leading-none" aria-hidden>
              {o.emoji}
            </span>
            {active && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, delay: 0.06 }}
                className="whitespace-nowrap font-semibold"
              >
                {o.label}
              </motion.span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

/** Legend for the season layers' JNTO-style land fade + date glyphs: a small
 *  cream card (same paper language as the prefecture popup) with a dark→light
 *  gradient strip reading Early → Late, and the two date emoji explained.
 *  Positioned by the caller into an empty sea corner of its map box. */
function SeasonLegend({
  layer,
  compact = false,
  className,
}: {
  layer: SeasonLayerId
  /** Mobile sheet: smaller type + tighter padding — the sheet's map is dense
   *  and the full-size card covered the southern labels. */
  compact?: boolean
  className?: string
}) {
  const ramp = SEASON_RAMPS[layer]
  // Ski's fade encodes season LENGTH (snow country → mild south), not
  // earliness — its bar reads differently from the two bloom layers.
  const { bar, keys } = {
    sakura: {
      bar: ['Early', 'Late'],
      keys: [
        { emoji: '🌸', label: 'First Bloom' },
        { emoji: '💮', label: 'Full Bloom' },
      ],
    },
    autumn: {
      bar: ['Early', 'Late'],
      keys: [
        { emoji: '🍂', label: 'Ginkgo' },
        { emoji: '🍁', label: 'Maple' },
      ],
    },
    ski: {
      bar: ['Long season', 'Short'],
      keys: [{ emoji: '❄️', label: 'Ski Season' }],
    },
  }[layer]
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.18 }}
      // min-w keeps the card (and its full-width gradient bar) comfortably
      // wide even when the key row is a single short entry (the Ski layer).
      className={`pointer-events-none rounded-xl border border-zen-black/10 bg-briefing-cream shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
        compact ? 'min-w-[140px] px-2.5 py-2' : 'min-w-[176px] px-3 py-2.5'
      } ${className ?? ''}`}
    >
      {/* JNTO-style year header — the dates on the markers are this year's
          (typical/forecast) windows. Bump yearly. */}
      <div className={`mb-1.5 font-headline font-bold tracking-wide text-zen-black ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        2026 Forecast
      </div>
      {/* Bar + key run the card's full width — the glyph key sits in ONE row
          (side by side), keeping the card short. */}
      <div
        className="h-1.5 w-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${ramp.join(', ')})` }}
        aria-hidden
      />
      {/* gap-3: with a wide left label (ski's "Long season") the two ends
          otherwise touch — the gap forces the card wider instead. */}
      <div className={`mt-1 flex justify-between gap-3 font-sans font-medium text-graphite/70 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        <span>{bar[0]}</span>
        <span>{bar[1]}</span>
      </div>
      <div className={`flex items-center ${compact ? 'mt-1 gap-2.5' : 'mt-1.5 gap-3'}`}>
        {keys.map((k) => (
          <div
            key={k.label}
            className={`flex items-center gap-1.5 whitespace-nowrap font-sans font-medium text-graphite ${compact ? 'text-[10px]' : 'text-[11px]'}`}
          >
            <span aria-hidden>{k.emoji}</span>
            {k.label}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/**
 * TripSearchSection — the ENTIRE "Ready-to-go Trips" experience as one shared
 * unit: title row + search pill + filter modal (destination multi-select,
 * travel dates, season quick-picks, flexibility) + removable filter chips +
 * the cards (TripDeck at every width, or TripCardCompact when compactCards) +
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

/** Does this trip belong to the given region? EXACT match against the trip's
 *  own region ids (parsed from V3 `overview.area_code` by GET /api/templates).
 *  Deliberately strict: a trip with no area_code matches no region filter —
 *  keyword inference was tried and false-matched across place names
 *  ("Kamikochi" ⊃ "Kochi"). */
function tripInRegion(t: PlanTemplate, regionId: string): boolean {
  return (t.regions ?? []).includes(regionId)
}

/** One region legend chip (colour dot + name) — shared by the desktop map
 *  overlay and the mobile map sheet. Toggles the region in the multi-select
 *  filter; on pointer devices it also mirrors hover onto the map. */
function RegionChip({
  region,
  active,
  onToggle,
  onHoverChange,
}: {
  region: (typeof JAPAN_REGIONS)[number]
  active: boolean
  onToggle: () => void
  onHoverChange?: (id: string | null) => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={onHoverChange ? () => onHoverChange(region.id) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(null) : undefined}
      aria-pressed={active}
      // Same glass as the search bar / Surprise-me button: white/15 hairline
      // over a white/10 fill with blur; selected deepens to a cream tint.
      // leading-none + items-center for the vertical: text-xs carries a 16px
      // line box around 12px glyphs, and that extra half-leading is split by
      // the font's own ascent/descent rather than evenly, so the label sat
      // off-centre against the dot. Collapsing the line box to the glyphs
      // lets the symmetric py-1.5 do the centring. (Same recipe as the
      // season pills in the filter modal.)
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left font-sans text-xs leading-none backdrop-blur-sm transition-[border-color,background-color,color] duration-300 ${
        active
          ? 'border-briefing-cream/45 bg-briefing-cream/20 font-semibold text-briefing-cream'
          : 'border-white/15 bg-white/10 text-briefing-cream/70 hover:border-basel-brick/60 hover:text-briefing-cream'
      }`}
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: region.color }} aria-hidden />
      {/* 1px optical nudge DOWN. Measured: the dot centres exactly on the
          chip, but the label's ink does not — the line box is centred, yet
          the glyphs' visual mass sits above its middle because the descender
          space stays empty for names like "Hokkaido". A whole pixel (never a
          fraction — that resamples the glyphs and softens them) squares the
          label with the dot. Same nudge the season pills use. */}
      <span className="translate-y-px">{region.name.replace(' Region', '')}</span>
    </button>
  )
}
/** Prefecture popup for a clicked (selected) region. One FIXED home for
 *  every region — the map's empty top-left sea area (per-region floating
 *  popovers were tried and hopped around confusingly). `anchored` = desktop
 *  panel; the mobile sheet letterboxes the drawing, so there it renders
 *  centered over the map instead. Staying inside the map box also matters
 *  mechanically: a popup poking outside extends the page's scrollable area,
 *  and its close shrank the page → scroll clamped → viewport jumped. */
function RegionPrefecturePopup({
  regionId,
  anchored,
  onClose,
}: {
  regionId: string
  anchored: boolean
  onClose: () => void
}) {
  const region = JAPAN_REGIONS.find((r) => r.id === regionId)
  const prefs = REGION_PREFECTURES[regionId] ?? []
  if (!region) return null
  return (
    <div
      className="pointer-events-none absolute z-20"
      // Same fixed home on both views: the map's empty top-left sea. The
      // sheet's letterboxed drawing floats centre-right, so its top-left is
      // just as free as the desktop panel's. (Mobile used to sit at 4% but
      // slid under the sheet's layer-toggle header row — 10% clears it.)
      style={{ left: '2%', top: '10%' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.18 }}
        // Cloud "paper" card — same surface language as the trip cards and
        // the map's own top faces; the region's accent tints the border and
        // the prefecture pills, so the card visibly belongs to its region.
        // Mobile (non-anchored) runs NARROWER so it stacks tall in the
        // letterboxed sheet's side sea instead of spanning the drawing.
        className={`pointer-events-auto w-max rounded-xl border bg-briefing-cream p-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${
          anchored ? 'max-w-[250px]' : 'max-w-[188px]'
        }`}
        style={{ borderColor: `${region.color}99` }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 whitespace-nowrap font-detail text-xs font-semibold tracking-wide text-zen-black">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: region.color }} aria-hidden />
            {region.name.replace(' Region', '')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close prefectures"
            className="grid size-5 place-items-center rounded-full text-graphite/50 transition-colors hover:bg-zen-black/10 hover:text-graphite"
          >
            <X className="size-3" strokeWidth={2.5} />
          </button>
        </div>
        <div className={`flex flex-wrap gap-1 ${anchored ? 'max-w-[220px]' : 'max-w-[148px]'}`}>
          {prefs.map((p) => (
            <span
              key={p}
              className="rounded-md px-1.5 py-0.5 font-sans text-[11px] leading-snug text-graphite"
              style={{ backgroundColor: `${region.color}40` }}
            >
              {p}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

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
          // In FLOW at every width (user call): as an absolute overlay this
          // list covered the modal's Done button. In flow the card simply
          // grows and Done stays visible below the list. `relative` only for
          // the z-index, so the shadow paints over the fields beneath.
          <div className="relative z-20 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-zen-black/10 bg-white shadow-xl shadow-black/15">
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
  compactCards = false,
  regionMap = false,
  myTripsHref,
}: {
  title: string
  subtitle: string
  /** Sign-in bounce + saved-templates return URL ('/' or '/discover'). */
  callbackUrl: string
  /** With NO filter active, show only the newest N (home). Omit → show ALL. */
  defaultCount?: number
  /** Render the desktop + mobile "View all" links pointing here (home only). */
  viewAllHref?: string
  /** Show a "My Trips →" link beside the subtitle (/discover): home already
   *  points at the catalogue with View all, so it doesn't need this. */
  myTripsHref?: string
  /** Read ?trip=CODE after load and auto-open that trip (shared links). */
  openFromQueryParam?: boolean
  /** 'h1' on pages where this is the main heading (/discover). */
  headingTag?: 'h1' | 'h2'
  /** Render the compact horizontal cards as a stacked list INSTEAD of the tall
   *  boarding-pass cards (deck on mobile / row on desktop). /discover uses
   *  this; home keeps the tall cards. */
  compactCards?: boolean
  /** Desktop-only sticky 3D Japan map panel to the RIGHT of the compact card
   *  list (/discover): title + map + region legend. Regions are a multi-select
   *  FILTER on the cards (click map or legend chips). Always visible from lg
   *  up; hidden below lg. compactCards mode only. */
  regionMap?: boolean
}) {
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedTemplate = selectedId ? templates.find((t) => t.id === selectedId) ?? null : null
  const { savedIds, pending, toggleHeart } = useSavedTemplates(callbackUrl)

  const [query, setQuery] = useState('')
  // "Recommend me ✈️": `planeFlying` runs the takeoff micro-interaction;
  // bumping `planeKey` remounts the emoji so a fresh plane glides back in.
  // `recommendOnly` additionally keeps only trips whose ADMIN-RECOMMENDED
  // (แนะนำ) windows are hit by the chosen travel window.
  const [planeFlying, setPlaneFlying] = useState(false)
  const [planeKey, setPlaneKey] = useState(0)
  const [recommendOnly, setRecommendOnly] = useState(false)
  // Multi-select destinations — a trip matches if it touches ANY selected
  // prefecture (OR), so adding picks widens results instead of zeroing them.
  const [destList, setDestList] = useState<string[]>([])
  // Multi-select REGIONS from the 3D map panel — same OR semantics.
  const [regionList, setRegionList] = useState<string[]>([])
  // The prefecture popup follows the LAST region selected; deselecting that
  // region (or ×) closes it. Other selections stay untouched.
  const [popupRegion, setPopupRegion] = useState<string | null>(null)
  const toggleRegion = (id: string) => {
    const selecting = !regionList.includes(id)
    setRegionList((prev) => (selecting ? [...prev, id] : prev.filter((r) => r !== id)))
    setPopupRegion((cur) => (selecting ? id : cur === id ? null : cur))
  }
  const resetRegions = () => {
    setRegionList([])
    setPopupRegion(null)
  }
  /** Layer switch CLEARS the region selection (and its popup): a filter
   *  picked while reading one layer shouldn't silently keep filtering the
   *  list under the next one (user call). */
  const switchMapLayer = (id: MapLayerId) => {
    if (id !== mapLayer) resetRegions()
    setMapLayer(id)
  }
  // Legend-chip hover, mirrored onto the map (lift + accent) via the map's
  // externalHoverRegion prop — CSS :hover can't cross from chip to SVG.
  const [hoverRegion, setHoverRegion] = useState<string | null>(null)
  // Mobile: the floating map button opens the region map as a bottom sheet.
  const [mapSheetOpen, setMapSheetOpen] = useState(false)
  // Which marker layer the map shows (cities / attractions / sakura / autumn)
  // — shared between the desktop panel and the mobile sheet.
  const [mapLayer, setMapLayer] = useState<MapLayerId>('cities')
  const seasonLayer = asSeasonLayer(mapLayer)
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
  // " · ±7 วัน" for the date chip when a widening is active (empty at ตรงเป๊ะ).
  const flexLabel = flex ? ` · ${FLEX_CHIPS.find((c) => c.value === flex)?.label ?? `±${flex} วัน`}` : ''
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
  const filtering = !!(q || destList.length || regionList.length || startD)
  // No filter → newest `defaultCount` (home) or the whole catalog (/discover).
  const base = defaultCount ? [...templates].slice(-defaultCount).reverse() : [...templates].reverse()
  const shown = filtering
    ? [...templates]
        .reverse() // newest first
        .filter((t) => {
          if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false
          if (destList.length && !destList.some((d) => t.title.toLowerCase().includes(d.toLowerCase()))) return false
          if (regionList.length && !regionList.some((r) => tripInRegion(t, r))) return false
          if (effStart && effEnd) {
            const ev = evaluateTrip(t.availability, effStart, effEnd, t.totalDays)
            if (!ev.matches) return false
            // Recommend-me mode: only trips the ADMIN starred for this window
            // (a feasible span lands in a แนะนำ range).
            if (recommendOnly && !ev.recommended) return false
          }
          return true
        })
    : base

  // Anti-jump: filtering shrinks the card list, the page gets shorter, and
  // the browser CLAMPS the scroll position — the viewport visibly jumps and
  // the sticky map shifts. The list area's UNFILTERED height is measured into
  // state and held as a permanent min-height: it's already in the DOM when a
  // filter lands, so the page never shortens under the user. (Kept in state,
  // not a ref — refs must not be read during render.)
  const listAreaRef = useRef<HTMLDivElement>(null)
  const [listMinH, setListMinH] = useState(0)
  useLayoutEffect(() => {
    if (!filtering && listAreaRef.current) {
      const h = listAreaRef.current.offsetHeight
      if (h > 0 && h !== listMinH) setListMinH(h)
    }
    // shown.length + tripsLoading: the unfiltered height must be re-measured
    // once the real cards replace the loading skeletons.
  }, [filtering, listMinH, shown.length, tripsLoading])

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

  // The filter-bubble row hangs BELOW the search bar as an absolute layer (so
  // chips can never move the bar itself). The header's static bottom margin
  // only reserves ONE line of it, so a wrapped set used to overlap the cards —
  // most visible on a phone, where every chip is its own line. Measure the row
  // and grow the reserve to match. ResizeObserver, not a render-time read:
  // wrapping depends on layout, and the row also changes as chips animate in.
  const chipsRef = useRef<HTMLDivElement>(null)
  const [chipsExtra, setChipsExtra] = useState(0)
  useEffect(() => {
    const el = chipsRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const baseReserve = compactCards ? 64 : 96 // mb-16 / mb-24
    const measure = () => {
      // 12px = the row's mt-3 hang, 16px = breathing room under the last line.
      const needed = el.offsetHeight + 12 + 16
      setChipsExtra(needed > baseReserve ? needed : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compactCards])

  const emptyText = filtering
    ? 'ไม่พบทริปที่ตรงเงื่อนไข · No matching trips'
    : 'ยังไม่มีแพลนในขณะนี้ · No trips yet.'

  return (
    <>
      {/* Tighter above the compact list (/discover) than above home's coverflow,
          which needs room for the fanned cards to breathe. The margin also
          RESERVES the line the absolutely-positioned filter bubbles hang into
          below the search bar — and GROWS with the measured bubble row, so a
          filter set that wraps to several lines pushes the cards down instead
          of overlapping them (the reserve is static only up to one line). */}
      <div
        className={compactCards ? 'mb-16' : 'mb-24'}
        style={chipsExtra > 0 ? { marginBottom: chipsExtra } : undefined}
      >
        <div className="md:flex md:items-center md:gap-14">
          <div className="shrink-0">
            <HeadingTag className="font-headline font-bold text-3xl md:text-5xl tracking-tight">{title}</HeadingTag>
            {/* Subtitle + an optional "My Trips →" shortcut on the same line,
                in the View-all link's vocabulary (uppercase, tracked, arrow
                that nudges on hover). flex-wrap so a narrow phone drops the
                link to its own row instead of squeezing the Thai copy. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="text-briefing-cream/70 font-sans">{subtitle}</p>
              {myTripsHref && (
                <Link
                  href={myTripsHref}
                  // ml-auto pins it to the right edge of the title block.
                  // Sentence case (no `uppercase`), so tracking-wide instead of
                  // -widest — wide tracking on mixed case reads as spaced-out.
                  className="group ml-auto flex items-center gap-1.5 font-headline text-xs font-bold tracking-wide text-briefing-cream/80 transition-colors hover:text-basel-brick"
                >
                  My Trips
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </div>
          {/* Search — desktop: same row, adjacent to the title (row gap only,
              no auto-centering); View all takes the right edge via ml-auto.
              Mobile: full-width below the title. Filter button INSIDE the
              field (far right); the chips live below the field. */}
          {/* md:flex-1 (no max-w cap): the bar + button line runs the row's
              full remaining width, ending symmetrically at the content edge
              (the old 4xl cap left a stray gap on the right — user call). */}
          <div className="mt-5 flex w-full max-w-lg items-center gap-2.5 md:mt-0 md:max-w-5xl md:flex-1">
          <div className="relative min-w-0 flex-1">
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
                // Solid Midnight chip, not a ghost icon (60% cream read as
                // decoration). Midnight is DARKER than the graphite canvas, so
                // it recedes — the hairline ring gives the chip an edge, and
                // Ocean-on-hover matches the app's other dark buttons.
                className={`absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full transition-colors ${
                  filterOpen
                    ? 'bg-briefing-cream text-zen-black'
                    : 'bg-zen-black text-white ring-1 ring-white/15 hover:bg-basel-brick'
                }`}
              >
                <SlidersHorizontal className="size-4" strokeWidth={2.25} />
                {activeFilterCount > 0 && (
                  // Ocean reads on both button states (Midnight and cream).
                  <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-basel-brick text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>


            {/* Active-filter bubbles — each removable ONLY via its ×.
                Regions picked on the 3D map appear here too, like any other
                filter. ABSOLUTELY positioned below the input: chips
                appearing/disappearing must never move the search bar (its
                vertical centering ignores this row); the space they hang
                into is reserved statically by the header block's bottom
                margin below. */}
            {
              <div ref={chipsRef} className="absolute left-0 top-full mt-3 flex w-full flex-wrap items-start gap-2">
                {regionList.map((id) => {
                  const region = JAPAN_REGIONS.find((r) => r.id === id)
                  if (!region) return null
                  return (
                    <span
                      key={id}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 py-1 pl-3 pr-1.5 text-xs font-semibold text-briefing-cream backdrop-blur-sm"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: region.color }}
                        aria-hidden
                      />
                      {region.name.replace(' Region', '')}
                      <button
                        type="button"
                        onClick={() => toggleRegion(id)}
                        aria-label={`Remove ${region.name}`}
                        className="grid size-5 place-items-center rounded-full text-briefing-cream/60 transition-colors hover:bg-white/15 hover:text-briefing-cream"
                      >
                        <X className="size-3" strokeWidth={2.5} aria-hidden />
                      </button>
                    </span>
                  )
                })}
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
                    {/* Recommend-me mode reads as the promise, a season
                        quick-pick as the season — raw dates otherwise. A ±flex
                        widening is part of what's filtering, so it trails the
                        label instead of hiding inside the modal. */}
                    {recommendOnly
                      ? '✈️ ทริปแนะนำ · 2–6 เดือนหน้า'
                      : seasonPick
                        ? `${SEASONS.find((s) => s.key === seasonPick)?.emoji ?? ''} ${seasonPick}${flexLabel}`
                        : `📅 ${fmtChipDate(startD)}${endD && endD.getTime() !== startD.getTime() ? ` – ${fmtChipDate(endD)}` : ''}${flexLabel}`}
                    <button
                      type="button"
                      onClick={() => { setRange(undefined); setFlex(0); setSeasonPick(null); setRecommendOnly(false) }}
                      aria-label="Remove dates"
                      className="grid size-5 place-items-center rounded-full text-briefing-cream/60 transition-colors hover:bg-white/15 hover:text-briefing-cream"
                    >
                      <X className="size-3" strokeWidth={2.5} aria-hidden />
                    </button>
                  </span>
                )}
              </div>
            }
          </div>
          {/* "Recommend me ✈️" — OUTSIDE the bar, on its right: one tap sets
              the travel window to 2–6 months out and keeps only trips whose
              admin แนะนำ (recommended/"starred") windows are hit. The emoji
              plays the takeoff micro-interaction on press. Label lg+ only —
              on phones it's the plane pill beside the bar. */}
          <button
            type="button"
            onClick={() => {
              const from = new Date()
              from.setMonth(from.getMonth() + 2)
              const to = new Date()
              to.setMonth(to.getMonth() + 6)
              setRange({ from, to })
              setSeasonPick(null)
              setFlex(0)
              setRecommendOnly(true)
              if (!planeFlying) setPlaneFlying(true)
            }}
            aria-label="Surprise me — trips for the next 2–6 months"
            // Same glass language as the search bar (border-white/15 +
            // white/10 fill + blur), answering hover with the bar's Ocean
            // border, so bar and button read as one instrument.
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-3 font-headline text-sm font-semibold text-briefing-cream backdrop-blur-sm transition-[border-color,box-shadow] duration-[350ms] hover:border-basel-brick/60 hover:shadow-[0_0_24px_rgba(91,136,178,0.22)]"
          >
            <motion.span
              key={planeKey}
              // leading-5 (20px), NOT leading-none: on mobile the label is
              // hidden, so this emoji alone sets the button's content height —
              // matching the input's text-sm line-height keeps the button
              // exactly as tall as the search bar (it was 4px shorter).
              className="grid place-items-center text-base leading-5"
              initial={planeKey === 0 ? false : { x: -30, y: 22, opacity: 0, rotate: -12 }}
              animate={
                planeFlying
                  ? { x: [0, 10, 68], y: [0, -4, -60], rotate: [0, -8, -22], opacity: [1, 1, 0] }
                  : { x: 0, y: 0, rotate: 0, opacity: 1 }
              }
              transition={planeFlying ? { duration: 0.55, ease: 'easeIn' } : { duration: 0.35, ease: 'easeOut' }}
              onAnimationComplete={() => {
                if (planeFlying) {
                  setPlaneFlying(false)
                  setPlaneKey((k) => k + 1)
                }
              }}
              aria-hidden
            >
              ✈️
            </motion.span>
            <span className="hidden whitespace-nowrap lg:inline">Surprise me</span>
          </button>
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
              // FULLY OPAQUE, and no backdrop-blur. Any alpha < 1 ghosts the
              // page through: directly behind this sit the white trip cards
              // with their black barcode strips, so even 8% transparency drew
              // faint horizontal lines that shifted with scroll position.
              // (backdrop-filter on the same element as overflow-y-auto also
              // renders a seam in Chrome — hence no blur either.) A full-screen
              // opaque takeover is the same pattern PlanPreviewModal uses.
              style={{ backgroundColor: '#0A1B33' }}
              // items-start + top padding (not centered): the date picker opens
              // DOWNWARD from inside the card, so the card sits a bit above
              // center to leave the calendar viewport room. overflow-y-auto
              // keeps short screens usable (scrim scrolls, nothing clips).
              // pt-8 on mobile (the 16vh drop is md+): a phone needs every
              // pixel once the destination list opens in flow below.
              className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto px-4 pb-6 pt-8 md:pt-[max(2rem,16vh)]"
              onClick={(e) => {
                if (e.target === e.currentTarget) setFilterOpen(false)
              }}
            >
              <motion.div
                // NO scale: a scaled layer rasterises its rounded edge on
                // subpixels, which draws a faint hairline just outside the
                // border-radius (it reads as a dashed underline below the
                // card). Opacity + y give the same entrance without it.
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                // Cloud card — solid briefing-cream (glass went muddy over the
                // dark scrim; a filter panel wants clarity). No drop shadow: a
                // wide black blur over the flat Midnight scrim is invisible but
                // can band, and the outermost band edge reads as a line.
                className="relative w-full max-w-sm rounded-3xl bg-briefing-cream p-5 font-detail"
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
                    setRecommendOnly(false)
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
                        // Hand-picking dates leaves recommend-me mode — the
                        // chip must never claim a promise the range broke.
                        setRecommendOnly(false)
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
                          setRecommendOnly(false)
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
                        <span className={`ml-1.5 translate-y-[1px] text-[10px] font-medium ${seasonPick === s.key ? 'text-white/85' : 'text-graphite/80'}`}>
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

      {/* Mobile "View all" — its OWN row directly above the cards, so it's
          reachable without scrolling past a ~600px deck. Not in the title row:
          the heading wraps to two lines on a phone and the link ended up
          stranded beside it. Desktop keeps its copy at the end of the header. */}
      {viewAllHref && (
        <Link
          href={viewAllHref}
          // -mt-14 (not -8): claws back most of the header's mb-24 chip-reserve
          // on phones — View all AND the deck ride up 24px closer to the search
          // bar, while one wrapped row of filter chips (~38px) still clears.
          className="group -mt-18 mb-6 ml-auto flex w-fit items-center gap-1.5 font-headline font-bold uppercase tracking-widest text-xs text-briefing-cream/70 transition-colors hover:text-basel-brick md:hidden"
        >
          View all
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {compactCards ? (
        /* Compact horizontal cards, stacked — /discover's whole catalogue. One
           layout at every width (no deck/row split): the card is already a row,
           so it just narrows. Same `shown` list and handlers as the tall cards,
           so the preview modal, lazy itinerary fetch and hearts work unchanged.
           md:items-start pins the stack to the LEFT from md up, leaving the
           right of the row free; centred on mobile, where it fills the width.
           md:pl-16 nudges it in off the very edge. */
        /* lg+ with the region map: TWO EQUAL halves, each centering its
           content, so the page reads symmetric (left gutter ≈ middle gap ≈
           right gutter). Below lg the map is hidden entirely — the mobile
           layout is exactly what it was. */
        <div
          ref={listAreaRef}
          className={regionMap ? 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-10' : undefined}
          // overflowAnchor none: even at frozen height, swapping the card list
          // lets the browser's scroll anchoring re-anchor to a moved node and
          // nudge the viewport — filtering must never move the scroll at all.
          style={{ overflowAnchor: 'none', ...(listMinH > 0 ? { minHeight: listMinH } : undefined) }}
        >
          <div className="flex flex-col items-center gap-5 md:items-start md:pl-16 lg:min-w-0 lg:items-center lg:pl-0">
            {tripsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[150px] w-full max-w-3xl animate-pulse rounded-xl border border-white/10 bg-white/5"
                />
              ))
            ) : shown.length > 0 ? (
              shown.map((tpl, i) => (
                /* Route-line rail (lg+): an Ocean node at each card's centre,
                   line segments joining node to node — starts at the first
                   card's dot, ends at the last's. Sits in the free space left
                   of the centred cards; hidden below lg. */
                <div key={tpl.id} className="relative w-full max-w-md">
                  <span
                    aria-hidden
                    className={`absolute -left-8 hidden w-[3px] -translate-x-1/2 bg-basel-brick/30 lg:block ${
                      i === 0 ? 'top-1/2' : '-top-2.5'
                    } ${i === shown.length - 1 ? 'bottom-1/2' : '-bottom-2.5'}`}
                  />
                  <span
                    aria-hidden
                    className="absolute -left-8 top-1/2 hidden size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-basel-brick/25 lg:grid"
                  >
                    <span className="size-3 rounded-full bg-basel-brick" />
                  </span>
                  <TripCardCompact
                    tpl={tpl}
                    saved={savedIds.has(tpl.id)}
                    isPending={pending.has(tpl.id)}
                    onOpen={(id) => setSelectedId(id)}
                    onHeart={(id, e) => toggleHeart(id, e)}
                  />
                </div>
              ))
            ) : (
              <p className="text-center text-briefing-cream/50 font-sans">{emptyText}</p>
            )}
          </div>
          {regionMap && (
            /* sticky top-24: parks just under the navbar while the card list
               scrolls past. Centered in its half, mirroring the cards.
               Palette: Cloud tops on the graphite canvas; Midnight extrusion
               sides (default slate would vanish against graphite). Selected
               regions fill with their own accent colour (mono-variant
               highlight), matching their legend dot. */
            <div className="hidden w-full max-w-[560px] lg:sticky lg:top-24 lg:block lg:justify-self-start lg:self-start xl:max-w-[660px]">
              {/* Title, then the legend as a 4×2 chip row, then the map at the
                  panel's full width. A chip is the same multi-select toggle
                  as clicking the region on the map; selected regions fill
                  with their accent colour, and hovering a chip mirrors the
                  map's own hover (lift + accent). */}
              {/* relative z-10: the map below overlaps this row (-mt-10);
                  keep the chips above the svg so their clicks/hover never get
                  stolen by a region path that reaches up this far. The ghost
                  reset trails the grid — beside the Kyushu-Okinawa chip. */}
              <div className="relative z-10 flex items-end gap-2">
                <div className="grid flex-1 grid-cols-4 gap-1.5">
                  {JAPAN_REGIONS.map((r) => (
                    <RegionChip
                      key={r.id}
                      region={r}
                      active={regionList.includes(r.id)}
                      onToggle={() => toggleRegion(r.id)}
                      onHoverChange={setHoverRegion}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={resetRegions}
                  disabled={regionList.length === 0}
                  className="-mr-2 mb-1 ml-2 flex translate-x-2 items-center gap-1.5 font-sans text-xs text-briefing-cream/80 transition-opacity hover:text-briefing-cream disabled:opacity-35"
                >
                  <RotateCcw className="size-3" strokeWidth={2.25} aria-hidden />
                  Reset
                </button>
              </div>
              {/* Layer toggles — swap the callout set (cities / attractions /
                  seasons). z-10 keeps them above the overlapping map. */}
              <div className="relative z-10 mt-5">
                <MapLayerControls layer={mapLayer} onChange={switchMapLayer} />
              </div>
              {/* -mt pulls the map's empty top sea band up under the rows
                  above; pointer-events-none on the svg keeps the overlapped
                  controls clickable (regions re-enable their own events). */}
              <div className="relative -mt-10">
                <JapanMap3D
                  interactive
                  depth={14}
                  topColor="#F7F9FC"
                  sideColor="#122C4F"
                  shadowColor="#000000"
                  highlightedRegions={regionList}
                  onRegionClick={toggleRegion}
                  externalHoverRegion={hoverRegion}
                  markers={MAP_LAYERS[mapLayer]}
                  regionTints={seasonLayer ? SEASON_TINTS[seasonLayer] : undefined}
                  className="pointer-events-none"
                />
                <AnimatePresence>
                  {popupRegion && (
                    <RegionPrefecturePopup
                      key={popupRegion}
                      regionId={popupRegion}
                      anchored
                      onClose={() => setPopupRegion(null)}
                    />
                  )}
                </AnimatePresence>
                {/* Season legend — STATIC home in the west sea directly below
                    the prefecture popup's fixed spot (top-left). It never
                    moves, popup open or not (user call). */}
                <AnimatePresence>
                  {seasonLayer && (
                    <div key={mapLayer} className="absolute left-[8%] top-[25%] z-20">
                      <SeasonLegend layer={seasonLayer} />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Two presentations of the SAME card: a vertical stack on the phone
          (cards peeking below the front one) and a 3D coverflow on desktop,
          which needs horizontal room a phone doesn't have. */}
      <div>
        {tripsLoading ? (
          <div
            style={{ width: DECK_CARD_W, height: DECK_CARD_H }}
            className="mx-auto animate-pulse rounded-[20px] border border-white/10 bg-white/5"
          />
        ) : shown.length > 0 ? (
          <>
            <div className="md:hidden">
              <TripDeck
                key={shown.map((t) => t.id).join('|')}
                templates={shown}
                savedIds={savedIds}
                pending={pending}
                onOpen={(id) => setSelectedId(id)}
                onHeart={(id, e) => toggleHeart(id, e)}
              />
            </div>
            <div className="hidden md:block">
              <TripCoverflow
                key={shown.map((t) => t.id).join('|')}
                templates={shown}
                savedIds={savedIds}
                pending={pending}
                onOpen={(id) => setSelectedId(id)}
                onHeart={(id, e) => toggleHeart(id, e)}
              />
            </div>
          </>
        ) : (
          <p className="text-center text-briefing-cream/50 font-sans">{emptyText}</p>
        )}
      </div>
        </>
      )}

      {/* Mobile region map: a static AssistiveTouch-style floating button
          (cloud-white circle, map glyph) opens the map + legend as a bottom
          sheet — the SAME regionList filter as the desktop panel. lg+ hides
          both (the sticky panel exists there instead). */}
      {regionMap && (
        <>
          {/* Mobile region-map button — a STATIC OVERLAY (AssistiveTouch
              style: fixed, stays put while the page scrolls), resting just
              below the search bar's filter button on load. Opens the map
              sheet. lg+ has the sticky map panel instead. */}
          <button
            type="button"
            onClick={() => setMapSheetOpen(true)}
            aria-label="Open region map"
            // top tracks /discover's pt-32 header (was 255px under the old
            // pt-26 — the page gained 24px of top padding).
            className="fixed right-4 top-[279px] z-40 grid size-11 place-items-center rounded-full border border-zen-black/10 bg-briefing-cream text-graphite shadow-[0_8px_24px_rgba(0,0,0,0.35)] lg:hidden"
          >
            <MapIcon size={18} strokeWidth={1.75} />
          </button>
          <AnimatePresence>
            {mapSheetOpen && (
              <>
                <motion.div
                  key="map-sheet-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMapSheetOpen(false)}
                  className="fixed inset-0 z-[69] bg-noir/50 lg:hidden"
                  aria-hidden
                />
                <motion.div
                  key="map-sheet"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl border-t border-briefing-cream/10 bg-graphite p-5 pb-8 lg:hidden"
                  role="dialog"
                  aria-label="8 Regions map filter"
                >
                  {/* relative z-10: the map wrapper below pulls the svg UP
                      under this row (-mt-6), and Hokkaido's clickable paths
                      sit exactly beneath the × — without the lift, taps on ×
                      hit the region instead (the close button went dead). */}
                  <div className="relative z-10 flex items-center justify-between">
                    {/* Layer toggles share the header line with the ×. */}
                    <MapLayerControls layer={mapLayer} onChange={switchMapLayer} />
                    <button
                      type="button"
                      onClick={() => setMapSheetOpen(false)}
                      aria-label="Close map"
                      className="grid size-8 place-items-center rounded-full bg-briefing-cream/10 text-briefing-cream"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {/* Negative margins pull the header/chips into the map
                      box's transparent sea zones — the svg's portrait viewBox
                      letterboxes inside this landscape-ish slot, leaving dead
                      space above and below the drawing. */}
                  <div className="relative -mb-10 -mt-6">
                    <JapanMap3D
                      interactive
                      depth={14}
                      topColor="#F7F9FC"
                      sideColor="#122C4F"
                      shadowColor="#000000"
                      highlightedRegions={regionList}
                      onRegionClick={toggleRegion}
                      width="100%"
                      height="64vh"
                      markers={MAP_LAYERS[mapLayer]}
                      // 1.45 (was 1.6): with the 18→21 font bump the east-rail
                      // labels outgrew even the overflow bleed room; net size
                      // is still above the original 18×1.6.
                      cityScale={1.45}
                      // The sheet's prefecture card spans ~half the drawing —
                      // it inevitably covers the NW label rail, so the
                      // callouts fade out while it's open (they return on
                      // close). Desktop's smaller card clears the labels.
                      dimMarkers={popupRegion !== null}
                      regionTints={seasonLayer ? SEASON_TINTS[seasonLayer] : undefined}
                      className="pointer-events-none"
                    />
                    {/* Season legend — right edge, stacked directly ABOVE the
                        ghost Reset in the bottom-right corner (user call). */}
                    <AnimatePresence>
                      {seasonLayer && (
                        <div key={mapLayer} className="absolute bottom-[18%] right-1 z-20">
                          <SeasonLegend layer={seasonLayer} compact />
                        </div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {popupRegion && (
                        <RegionPrefecturePopup
                          key={popupRegion}
                          regionId={popupRegion}
                          anchored={false}
                          onClose={() => setPopupRegion(null)}
                        />
                      )}
                    </AnimatePresence>
                    {/* Bare ghost reset (no pill), right-aligned directly
                        ABOVE the chip grid's right column (the Tohoku chip) —
                        always rendered, dimmed when nothing is selected. */}
                    <button
                      type="button"
                      onClick={resetRegions}
                      disabled={regionList.length === 0}
                      className="absolute bottom-[12%] right-1 z-20 flex items-center gap-1.5 font-sans text-xs text-briefing-cream/80 transition-opacity disabled:opacity-35"
                    >
                      <RotateCcw className="size-3" strokeWidth={2.25} aria-hidden />
                      Reset
                    </button>
                  </div>
                  {/* relative z-10: the map wrapper above is POSITIONED (for
                      its popup/reset overlays) and overlaps this grid via
                      -mb-10 — without the lift, the Okinawa island trail's
                      clickable paths sat over some chips and stole their
                      taps. */}
                  <div className="relative z-10 grid grid-cols-2 gap-1.5">
                    {JAPAN_REGIONS.map((r) => (
                      <RegionChip
                        key={r.id}
                        region={r}
                        active={regionList.includes(r.id)}
                        onToggle={() => toggleRegion(r.id)}
                      />
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Preview + duplicate modal — the picked travel window pre-fills its
          date step. NOT in Surprise-me mode: that window is a 2–6 month
          SEARCH range, not a trip the user intends to take, and seeding it
          would open the date step on a ~120-day trip with ~112 free days. */}
      <PlanPreviewModal
        template={selectedTemplate}
        defaultStartDate={!recommendOnly && startD ? toISODate(startD) : ''}
        defaultEndDate={!recommendOnly && endD ? toISODate(endD) : ''}
        callbackUrl={callbackUrl}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}
