/**
 * Seasonal availability matching for pre-planned trips.
 *
 * Availability is stored on `Template.availability` as a `TripAvailability`
 * (see lib/itinerary-types.ts) using YEAR-AGNOSTIC "MM-DD" ranges. This module
 * is the single source of truth for:
 *   1. validating/normalizing availability coming from the admin form (write path)
 *   2. deciding whether a trip matches a user's chosen travel window (read path)
 *   3. formatting ranges for display (bilingual)
 *
 * Matching semantics (TRIP OVERLAPS THE WINDOW):
 *   The user picks a window [windowStart, windowEnd] — when they'd like to travel.
 *   A trip matches if there EXISTS a placement (departure day `s`) such that:
 *     (a) the full trip span [s, s + totalDays − 1] is entirely inside the trip's
 *         `available` ranges (nothing closed during the trip), AND
 *     (b) the span OVERLAPS the window — i.e. the departure OR the arrival (or any
 *         day between) falls within [windowStart, windowEnd].
 *   So the trip may start a little before the window or finish a little after it,
 *   as long as it touches the window and stays seasonally open. A Kamikochi trip
 *   (open ~late-Apr → mid-Nov) still disappears for a December window because no
 *   open placement touches December; a 5-day Hokkaido trip (open Dec 1 →) shows
 *   for an 18 Nov–3 Dec window because departing Dec 1 (Dec 1–5, all open) lands
 *   inside it.
 *
 * Pure module — no DB, no React, safe to import anywhere.
 */
import type { DateRange, TripAvailability } from './itinerary-types'

// ── MM-DD helpers ─────────────────────────────────────────────────────────────

const MMDD_RE = /^(\d{2})-(\d{2})$/
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] // Feb=29 tolerated

/** Valid "MM-DD" with a real month (01–12) and day for that month. */
export function isValidMMDD(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = MMDD_RE.exec(s)
  if (!m) return false
  const month = Number(m[1])
  const day = Number(m[2])
  if (month < 1 || month > 12) return false
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) return false
  return true
}

/** "MM-DD" → comparable ordinal (month*100 + day). */
function ordinal(month: number, day: number): number {
  return month * 100 + day
}

/** Does a concrete calendar date fall inside a year-agnostic range (wrap-aware)? */
function dateInRange(date: Date, range: DateRange): boolean {
  const fm = Number(range.from.slice(0, 2))
  const fd = Number(range.from.slice(3, 5))
  const tm = Number(range.to.slice(0, 2))
  const td = Number(range.to.slice(3, 5))
  const x = ordinal(date.getMonth() + 1, date.getDate())
  const from = ordinal(fm, fd)
  const to = ordinal(tm, td)
  // Normal range: from <= to. Wrapping range (e.g. Dec→Feb): from > to.
  return from <= to ? x >= from && x <= to : x >= from || x <= to
}

function dateInAnyRange(date: Date, ranges: DateRange[]): boolean {
  return ranges.some((r) => dateInRange(date, r))
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + n)
  return d
}

// ── Matching ──────────────────────────────────────────────────────────────────

export interface MatchResult {
  /** Trip can be done without hitting a closure for at least one feasible start. */
  matches: boolean
  /** A feasible span also lands in a recommended window — badge + sort to top. */
  recommended: boolean
}

/** Every day of [start, start+totalDays-1] is inside the available ranges. */
function spanFullyAvailable(start: Date, totalDays: number, available: DateRange[]): boolean {
  if (available.length === 0) return true // empty = always available
  for (let i = 0; i < totalDays; i++) {
    if (!dateInAnyRange(addDays(start, i), available)) return false
  }
  return true
}

/** Any day of the span lands in a recommended range. */
function spanHitsRecommended(start: Date, totalDays: number, recommended: DateRange[]): boolean {
  if (recommended.length === 0) return false
  for (let i = 0; i < totalDays; i++) {
    if (dateInAnyRange(addDays(start, i), recommended)) return true
  }
  return false
}

/**
 * Evaluate a trip against a travel window [windowStart, windowEnd] (inclusive).
 * `availability` null/undefined ⇒ always seasonally open (still must fit the window).
 */
export function evaluateTrip(
  availability: TripAvailability | null | undefined,
  windowStart: Date,
  windowEnd: Date,
  totalDays: number
): MatchResult {
  const available = availability?.available ?? []
  const recommended = availability?.recommended ?? []
  const days = Math.max(1, totalDays || 1)

  let matches = false
  let recommendedHit = false
  // Departure can be as early as (windowStart − (days−1)), so the ARRIVAL still
  // lands in the window, up to windowEnd (departure in the window). Every `s` in
  // this range yields a span that overlaps the window; we just need it fully open.
  const earliest = addDays(windowStart, -(days - 1))
  for (let s = earliest; s <= windowEnd; s = addDays(s, 1)) {
    if (spanFullyAvailable(s, days, available)) {
      matches = true
      if (spanHitsRecommended(s, days, recommended)) {
        recommendedHit = true
        break // matched AND recommended — best possible, stop early
      }
    }
  }
  return { matches, recommended: recommendedHit }
}

// ── Validation (write path) ────────────────────────────────────────────────────

function validateRanges(value: unknown, field: string): DateRange[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error(`availability.${field} must be an array`)
  return value.map((r, i) => {
    if (!r || typeof r !== 'object') throw new Error(`availability.${field}[${i}] must be an object`)
    const { from, to } = r as Record<string, unknown>
    if (!isValidMMDD(from) || !isValidMMDD(to)) {
      throw new Error(`availability.${field}[${i}] needs valid "MM-DD" from/to`)
    }
    return { from, to }
  })
}

/**
 * Normalize availability coming from the admin form. Returns:
 *   - null  → "always available" (empty available, empty recommended, no note)
 *   - object → validated TripAvailability
 * Throws Error with a human message on malformed input.
 */
export function parseAvailabilityInput(raw: unknown): TripAvailability | null {
  if (raw == null) return null
  if (typeof raw !== 'object') throw new Error('availability must be an object or null')
  const obj = raw as Record<string, unknown>
  const available = validateRanges(obj.available, 'available')
  const recommended = validateRanges(obj.recommended, 'recommended')
  const note = typeof obj.note === 'string' && obj.note.trim() ? obj.note.trim() : undefined
  if (available.length === 0 && recommended.length === 0 && !note) return null
  return { available, recommended, note }
}

// ── Formatting (display) ────────────────────────────────────────────────────────

const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMMDD(mmdd: string, lang: 'th' | 'en'): string {
  const month = Number(mmdd.slice(0, 2))
  const day = Number(mmdd.slice(3, 5))
  const name = (lang === 'th' ? MONTH_TH : MONTH_EN)[month - 1]
  return `${day} ${name}`
}

/** "27 เม.ย. – 15 พ.ย." (single range). */
export function formatRange(range: DateRange, lang: 'th' | 'en' = 'th'): string {
  return `${formatMMDD(range.from, lang)} – ${formatMMDD(range.to, lang)}`
}

/** Multiple ranges joined by " · ". Empty ⇒ "ตลอดทั้งปี"/"All year". */
export function formatRanges(ranges: DateRange[], lang: 'th' | 'en' = 'th'): string {
  if (!ranges || ranges.length === 0) return lang === 'th' ? 'ตลอดทั้งปี' : 'All year'
  return ranges.map((r) => formatRange(r, lang)).join(' · ')
}

// ── Season derivation ─────────────────────────────────────────────────────────
// The trip's season is derived from its availability windows (no manual picker).

const SEASON_BY_MONTH = [
  'Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer',
  'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter',
] // index = month-1 (Jan…Dec)

/** Northern-hemisphere season for a 1–12 month. */
export function seasonForMonth(month: number): string {
  return SEASON_BY_MONTH[(month - 1 + 12) % 12]
}

/** Distinct seasons a set of MM-DD ranges spans, in the order encountered. */
export function seasonsForRanges(ranges: DateRange[]): string[] {
  const seen: string[] = []
  for (const r of ranges ?? []) {
    const fm = Number(r.from.slice(0, 2))
    const tm = Number(r.to.slice(0, 2))
    let m = fm
    for (let i = 0; i < 12; i++) {
      const s = seasonForMonth(m)
      if (!seen.includes(s)) seen.push(s)
      if (m === tm) break
      m = (m % 12) + 1 // walk forward, wrapping Dec→Jan
    }
  }
  return seen
}

/** Single primary season for a trip: recommended window first, else available. */
export function primarySeason(recommended: DateRange[], available: DateRange[]): string | null {
  return seasonsForRanges(recommended)[0] ?? seasonsForRanges(available)[0] ?? null
}
