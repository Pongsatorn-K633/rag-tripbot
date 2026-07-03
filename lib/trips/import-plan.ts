import type {
  ItineraryV3, DayV3, ActivityV3, PlanOverview, PlanPeriod, PlanCarRental, PlanLinks,
  Bilingual, HighlightV3, PlanPriority, PlanQueueTime, PlanBookingPolicy,
  DateRange, TripAvailability,
} from '@/lib/itinerary-types'
import { safeHref } from '@/lib/url'

/**
 * Import a transformer plan JSON (the shape defined by docs/pre-planned-trip/columns.md)
 * into a canonical {@link ItineraryV3}. This is *validation + light normalization*, not a
 * rename — V3 mirrors the JSON 1:1. It cleans "(fill in app)" placeholders, coerces Y/N →
 * bool, derives the app-compat top-level fields (title/totalDays/airports), and drops
 * nameless spacer rows. `maps_api_call` is preserved but not acted on yet (deferred).
 */
export class PlanImportError extends Error {}

const PLACEHOLDER = /^\(fill in app\)$/i

function cleanStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return !s || PLACEHOLDER.test(s) ? undefined : s
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

function toBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (['y', 'yes', 'true', '1'].includes(s)) return true
    if (['n', 'no', 'false', '0', ''].includes(s)) return false
  }
  return null
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null
}

function bilingual(v: unknown): Bilingual | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const en = typeof o.en === 'string' ? o.en : ''
  const th = typeof o.th === 'string' ? o.th : ''
  return en || th ? { en, th } : null
}

function coverImages(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x.trim() && !PLACEHOLDER.test(x))
  const s = cleanStr(v)
  return s ? s.split(/[;\n]/).map((x) => x.trim()).filter(Boolean) : []
}

function period(v: unknown): PlanPeriod | undefined {
  if (typeof v === 'string') { const s = cleanStr(v); return s ? { primary: s } : undefined }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const primary = cleanStr(o.primary), details = cleanStr(o.details)
    return primary || details ? { primary, details } : undefined
  }
  return undefined
}

/** Normalize one OR many period entries → a clean array (drops empties). */
function periods(v: unknown): PlanPeriod[] {
  const arr = Array.isArray(v) ? v : v != null && v !== '' ? [v] : []
  return arr.map(period).filter((p): p is PlanPeriod => !!p)
}

function carRental(v: unknown): PlanCarRental | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const d = (o.details && typeof o.details === 'object' ? o.details : null) as Record<string, unknown> | null
  const groups = d && Array.isArray(d.byGroupSize) ? d.byGroupSize : null
  return {
    primary: cleanStr(o.primary),
    details: d ? {
      rentalDuration: cleanStr(d.rentalDuration),
      byGroupSize: groups
        ? groups.map((g) => {
            const gg = (g ?? {}) as Record<string, unknown>
            return { size: String(gg.size ?? ''), advice: String(gg.advice ?? '') }
          })
        : undefined,
    } : undefined,
  }
}

function airportCodes(v: unknown): { hubs: { name: string; code: string }[]; codes: string[] } {
  const raw = (v && typeof v === 'object' ? (v as Record<string, unknown>).major_hubs : null)
  const list = Array.isArray(raw) ? raw : []
  const hubs = list.map((h) => {
    const o = (h ?? {}) as Record<string, unknown>
    return { name: String(o.name ?? ''), code: String(o.code ?? '') }
  })
  return { hubs, codes: hubs.map((h) => h.code).filter(Boolean) }
}

function highlight(v: unknown): HighlightV3 | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = cleanStr(o.name)
  if (!name) return null
  return { name, description: cleanStr(o.description) ?? '', level: typeof o.level === 'string' ? o.level : '' }
}

function normalizeActivity(a: unknown): ActivityV3 | null {
  if (!a || typeof a !== 'object') return null
  const o = a as Record<string, unknown>
  const name = bilingual(o.name)
  if (!name) return null // nameless row = spacer; skip
  const l = (o.links && typeof o.links === 'object' ? o.links : null) as PlanLinks | null
  return {
    slot: typeof o.slot === 'string' ? o.slot : '',
    is_default: toBool(o.is_default),
    time: cleanStr(o.time) ?? null,
    duration_min: num(o.duration_min) ?? null,
    priority: oneOf<PlanPriority>(o.priority, ['Must', 'Recommend', 'Normal']),
    location: cleanStr(o.location) ?? null,
    name,
    description: bilingual(o.description),
    cost: cleanStr(o.cost) ?? null,
    rating: num(o.rating) ?? null,
    category: cleanStr(o.category) ?? null,
    operating_hours: cleanStr(o.operating_hours) ?? null,
    queue_time: oneOf<PlanQueueTime>(o.queue_time, ['Low', 'Mid', 'High', 'Reserve']),
    booking_policy: oneOf<PlanBookingPolicy>(o.booking_policy, ['Walk-in Only', 'Same-Day Ticket', 'Optional', 'Recommended', 'Mandatory']),
    how_to_book: cleanStr(o.how_to_book) ?? null,
    maps_api_call: toBool(o.maps_api_call),
    notes: bilingual(o.notes),
    remark: bilingual(o.remark),
    links: l ? {
      // safeHref drops javascript:/data: schemes — only http(s) links survive.
      map: safeHref(cleanStr(l.map)) ?? null,
      walking_route: safeHref(cleanStr(l.walking_route)) ?? null,
      ig: safeHref(cleanStr(l.ig)) ?? null,
      fb: safeHref(cleanStr(l.fb)) ?? null,
      tt: safeHref(cleanStr(l.tt)) ?? null,
      website: safeHref(cleanStr(l.website)) ?? null,
    } : null,
  }
}

function normalizeDay(d: unknown, idx: number): DayV3 {
  const o = (d ?? {}) as Record<string, unknown>
  const acts = Array.isArray(o.activities)
    ? o.activities.map(normalizeActivity).filter((a): a is ActivityV3 => !!a)
    : []
  return {
    day: typeof o.day === 'number' ? o.day : idx + 1,
    name: bilingual(o.name) ?? { en: '', th: '' },
    activities: acts,
  }
}

export function importPlanJson(raw: unknown): ItineraryV3 {
  if (!raw || typeof raw !== 'object') throw new PlanImportError('Plan JSON must be an object')
  const j = raw as Record<string, unknown>
  const ov = (j.overview && typeof j.overview === 'object' ? j.overview : {}) as Record<string, unknown>
  const rawDays = Array.isArray(j.days) ? j.days : null
  if (!rawDays || rawDays.length === 0) throw new PlanImportError('Plan JSON has no days')

  const title = cleanStr(ov.title) ?? cleanStr(j.title) ?? 'Untitled trip'
  const { hubs, codes } = airportCodes(ov.available_airports)
  const days = rawDays.map(normalizeDay)

  const overview: PlanOverview = {
    title,
    cover_tagline: cleanStr(ov.cover_tagline),
    description: cleanStr(ov.description),
    available_period: period(ov.available_period),
    recommended_period: periods(ov.recommended_period),
    area_code: cleanStr(ov.area_code),
    cover_images: coverImages(ov.cover_images),
    available_airports: { major_hubs: hubs },
    car_rental: carRental(ov.car_rental),
    arrival_to_first_act_hrs: num(ov.arrival_to_first_act_hrs),
    arrival_to_departure_airport_hrs: num(ov.arrival_to_departure_airport_hrs),
    logistic_guide_en: cleanStr(ov.logistic_guide_en), logistic_guide_th: cleanStr(ov.logistic_guide_th),
    accommodation_guide_en: cleanStr(ov.accommodation_guide_en), accommodation_guide_th: cleanStr(ov.accommodation_guide_th),
    food_guide_en: cleanStr(ov.food_guide_en), food_guide_th: cleanStr(ov.food_guide_th),
    remark_en: cleanStr(ov.remark_en), remark_th: cleanStr(ov.remark_th),
    queue_guide_en: cleanStr(ov.queue_guide_en), queue_guide_th: cleanStr(ov.queue_guide_th),
  }

  const highlights = Array.isArray(j.highlights)
    ? j.highlights.map(highlight).filter((h): h is HighlightV3 => !!h)
    : undefined

  return {
    version: 3,
    title,
    totalDays: days.length,
    airports: codes.length ? codes : undefined,
    overview,
    highlights,
    reference_date: cleanStr(j.reference_date),
    sourceFile: cleanStr(j.source_file),
    days,
  }
}

// ── availability (derive the /discover date filter from the period strings) ──

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Parse a human period like "17 April - 15 Nov" → a year-agnostic DateRange
 *  ({ from: "04-17", to: "11-15" }). Returns null if it doesn't parse. */
export function parsePeriod(s?: string): DateRange | null {
  if (!s) return null
  const parts = s.split(/\s*[-–—]\s*/)
  if (parts.length !== 2) return null
  const side = (p: string): string | null => {
    const m = p.trim().match(/(\d{1,2})\s+([A-Za-z]{3,})/) // "17 April"
    if (!m) return null
    const day = parseInt(m[1], 10)
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (!mon || day < 1 || day > 31) return null
    return `${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const from = side(parts[0]), to = side(parts[1])
  return from && to ? { from, to } : null
}

/** Best-effort TripAvailability from a V3 overview's period strings — drives the
 *  /discover date filter + the card's "เปิดให้เที่ยว" line. */
export function deriveAvailability(itin: ItineraryV3): TripAvailability {
  const avail = parsePeriod(itin.overview.available_period?.primary)
  const rec = (itin.overview.recommended_period ?? [])
    .map((p) => parsePeriod(p.primary))
    .filter((r): r is DateRange => !!r)
  return { available: avail ? [avail] : [], recommended: rec }
}
