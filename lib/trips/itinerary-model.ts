import type {
  Itinerary, ItineraryV2, ItineraryV3, AnyItinerary, Day, DayV2, DayV3, ActivityV3,
  Activity, Choice, ActivityCategory, ActivityPriority, PlanPriority,
  NodeSnap, Slot, Meals, FlightLeg, TripFlight,
} from '@/lib/itinerary-types'
import { PLAN_MEAL_SLOTS, PLAN_CHOOSABLE_SLOTS } from '@/lib/itinerary-types'

/**
 * Itinerary compat layer (Phase N3 — docs/node-architecture-spec.md).
 *
 * A trip's jsonb is either v1 (flat `activities` + `choices`) or v2 (node/slot:
 * `meals` + node-wrapped `activities` + accommodation/transport slots). Every
 * READER (ItineraryView, injector, exporter) goes through `getRenderDays`, which
 * returns the v1 `Day[]` render shape for BOTH versions — so consumers never
 * branch on version. `migrateV1toV2` powers the one-off N5 migration.
 */

// ── version detection ────────────────────────────────────────────────────────

export function isV2(itin: unknown): itin is ItineraryV2 {
  return !!itin && typeof itin === 'object' && (itin as { version?: number }).version === 2
}

export function isV3(itin: unknown): itin is ItineraryV3 {
  return !!itin && typeof itin === 'object' && (itin as { version?: number }).version === 3
}

// ── category code ↔ v1 enum ──────────────────────────────────────────────────

/** v2 categoryCode → coarse v1 enum (for the CategoryIcon when no emoji). */
export function categoryForCode(code: string | undefined | null): ActivityCategory {
  if (!code) return 'other'
  if (code.startsWith('log.air')) return 'flight'
  if (code.startsWith('log.')) return 'transport'
  if (code.startsWith('live.')) return 'accommodation'
  if (code.startsWith('food.')) return 'food'
  if (code.startsWith('exp.act')) return 'experience'
  if (code.startsWith('exp.')) return 'sightseeing'
  if (code.startsWith('shop.')) return 'shopping'
  return 'other'
}

/** v1 enum → a sensible default v2 categoryCode (for migration; lossy). */
function codeForCategory(cat: ActivityCategory | undefined): string {
  switch (cat) {
    case 'flight': return 'log.air.domestic'
    case 'transport': return 'log.rail.metro'
    case 'food': return 'food.dine.restaurant'
    case 'sightseeing': return 'exp.land.nature'
    case 'shopping': return 'shop.mall'
    case 'accommodation': return 'live.stay.hotel'
    case 'experience': return 'exp.act.workshop'
    default: return 'exp.act.strolling'
  }
}

const MEAL = {
  breakfast: { emoji: '🍳', th: 'มื้อเช้า', en: 'Breakfast', kws: ['เช้า', 'breakfast', 'มื้อเช้า'] },
  brunch: { emoji: '🥐', th: 'มื้อสาย', en: 'Brunch', kws: ['สาย', 'brunch', 'บรันช์', 'มื้อสาย'] },
  lunch: { emoji: '🍱', th: 'มื้อกลางวัน', en: 'Lunch', kws: ['กลางวัน', 'lunch', 'เที่ยง'] },
  afternoon: { emoji: '🍵', th: 'มื้อบ่าย', en: 'Afternoon Meal', kws: ['บ่าย', 'afternoon', 'มื้อบ่าย', 'ของว่าง', 'snack'] },
  dinner: { emoji: '🍽️', th: 'มื้อเย็น', en: 'Dinner', kws: ['เย็น', 'dinner', 'ค่ำ', 'มื้อเย็น'] },
  latenight: { emoji: '🌙', th: 'มื้อดึก', en: 'Latenight Meal', kws: ['ดึก', 'late', 'latenight', 'late night', 'supper', 'มื้อดึก'] },
} as const
type MealKey = keyof typeof MEAL

// ── v2 → v1 render shape ─────────────────────────────────────────────────────

function nodeToActivity(
  n: NodeSnap,
  opts?: { time?: string | null; priority?: ActivityPriority; tag?: string }
): Activity {
  const notes = opts?.tag ? [opts.tag, n.notes].filter(Boolean).join(' — ') : n.notes ?? undefined
  return {
    time: opts?.time ?? n.time ?? '',
    name: n.name,
    nameTh: n.nameTh ?? null,
    notes: notes || undefined,
    priority: opts?.priority,
    category: categoryForCode(n.categoryCode),
    emoji: n.emoji ?? null,
    cost: n.cost ?? undefined,
    duration: n.duration ?? undefined,
    mapUrl: n.mapUrl ?? null,
    isLogistics: !!n.categoryCode?.startsWith('log.'),
  }
}

function byTime(a: Activity, b: Activity): number {
  const ta = (a.time ?? '').trim()
  const tb = (b.time ?? '').trim()
  if (ta && tb) return ta.localeCompare(tb)
  if (ta) return -1
  if (tb) return 1
  return 0
}

function v2DayToRenderDay(d: DayV2): Day {
  const activities: Activity[] = []
  const choices: Choice[] = []

  // Meals: single → timeline activity (with a meal tag); choice → a choice group.
  ;(Object.keys(MEAL) as MealKey[]).forEach((key) => {
    const slot = d.meals?.[key]
    if (!slot) return
    const m = MEAL[key]
    if (slot.kind === 'single') {
      activities.push(nodeToActivity(slot.node, { tag: `${m.emoji} ${m.th}` }))
    } else {
      choices.push({
        label: `${m.emoji} ${m.th} · ${m.en}`,
        category: 'food',
        selected: slot.selected ?? undefined,
        options: slot.options.map((n) => nodeToActivity(n)),
      })
    }
  })

  for (const a of d.activities ?? []) {
    activities.push(nodeToActivity(a.node, { time: a.time ?? a.node.time, priority: a.priority }))
  }
  activities.sort(byTime)

  let accommodation: string | null = null
  let accommodationChoices: Day['accommodationChoices']
  const acc = d.accommodation
  if (acc?.kind === 'single') accommodation = acc.node.name
  else if (acc?.kind === 'choice') {
    accommodationChoices = acc.options.map((n) => ({
      name: n.name, cost: n.cost ?? undefined, notes: n.notes ?? undefined,
    }))
  }

  const transport =
    // Defensive: a legacy free-day padded into a v2 trip may carry transport as a
    // string ('') instead of an array — coerce so we never call .map on a string.
    (Array.isArray(d.transport) ? d.transport : [])
      .map((leg) => {
        const route = [leg.from, leg.to].filter(Boolean).join(' → ')
        const via = leg.node ? `${leg.node.emoji ?? ''} ${leg.node.name}`.trim() : ''
        return [route, via, leg.notes].filter(Boolean).join(' · ')
      })
      .filter(Boolean)
      .join('\n') // '' when no legs → ItineraryView skips it (falsy)

  return {
    day: d.day, location: d.location, free: d.free,
    activities, choices, accommodation, accommodationChoices, transport,
  }
}

// ── v3 → v1 render shape ─────────────────────────────────────────────────────
// V3 is a flat per-day activity list tagged by `slot`. We re-derive the v1 render
// shape: meals/Activity-N choice groups (adjacent same-slot runs) → choices,
// Living → accommodation, everything else → the timeline. Rich V3 fields
// (queue/booking/rating/links/guides) are NOT shown yet — that's Phase 4.

const PLAN_MEAL_TO_KEY: Record<string, MealKey> = {
  Breakfast: 'breakfast', Brunch: 'brunch', Lunch: 'lunch',
  AfternoonMeal: 'afternoon', Dinner: 'dinner', LatenightMeal: 'latenight',
}

function planPriority(p?: PlanPriority | null): ActivityPriority | undefined {
  return p === 'Must' ? 'mandatory' : p === 'Recommend' ? 'recommended' : p === 'Normal' ? 'optional' : undefined
}

function slotEmoji(slot: string): string | null {
  const key = PLAN_MEAL_TO_KEY[slot]
  if (key) return MEAL[key].emoji
  if (slot === 'Living') return '🏨'
  if (slot === 'Logistics') return '🚆'
  if (slot === 'Admin & Services') return '🛂'
  return null
}

function slotLabel(slot: string): string {
  const key = PLAN_MEAL_TO_KEY[slot]
  if (key) return `${MEAL[key].emoji} ${MEAL[key].th} · ${MEAL[key].en}`
  return slot
}

function v3ToActivity(a: ActivityV3, opts?: { tag?: string }): Activity {
  const desc = a.description?.th || a.description?.en || undefined
  const notes = [opts?.tag, desc].filter(Boolean).join(' — ') || undefined
  const l = a.links
  return {
    time: a.time ?? '',
    name: a.name.en || a.name.th,
    nameTh: a.name.th || null,
    notes,
    priority: planPriority(a.priority),
    category: undefined,
    emoji: slotEmoji(a.slot),
    cost: a.cost ?? undefined,
    duration: a.duration_min ? `${a.duration_min} นาที` : undefined,
    mapUrl: l?.map ?? null,
    isLogistics: a.slot === 'Logistics',
    location: a.location ?? undefined,
    rating: a.rating ?? undefined,
    operatingHours: a.operating_hours ?? undefined,
    queueTime: a.queue_time ?? undefined,
    bookingPolicy: a.booking_policy ?? undefined,
    howToBook: a.how_to_book ?? undefined,
    remark: a.remark?.th || a.remark?.en || undefined,
    walkingUrl: l?.walking_route ?? undefined,
    social: l ? { ig: l.ig, fb: l.fb, tt: l.tt, website: l.website } : undefined,
  }
}

function v3DayToRenderDay(day: DayV3): Day {
  const acts = day.activities ?? []
  const mealSet = new Set<string>(PLAN_MEAL_SLOTS)
  const choosable = new Set<string>(PLAN_CHOOSABLE_SLOTS)

  const activities: Activity[] = []
  const choices: Choice[] = []
  let accommodation: string | null = null
  let accommodationChoices: Day['accommodationChoices']

  // Walk in order, collapsing each run of adjacent same-slot rows.
  let i = 0
  while (i < acts.length) {
    const slot = acts[i].slot
    let j = i + 1
    while (j < acts.length && acts[j].slot === slot) j++
    const run = acts.slice(i, j)
    i = j

    if (slot === 'Living') {
      if (run.length === 1) accommodation = run[0].name.en || run[0].name.th
      else accommodationChoices = run.map((r) => ({
        name: r.name.en || r.name.th,
        cost: r.cost ?? undefined,
        notes: (r.description?.th || r.description?.en) ?? undefined,
      }))
      continue
    }

    if (choosable.has(slot)) {
      // Choosable slots ALWAYS render as a carousel — even a single option — and
      // carry a time so they interleave into the timeline at their real spot.
      const def = run.findIndex((r) => r.is_default) // is_default → admin's ⭐ recommended option
      choices.push({
        label: slotLabel(slot),
        category: mealSet.has(slot) ? 'food' : undefined,
        time: run[0].time ?? undefined,
        recommended: def >= 0 ? def : undefined,
        options: run.map((r) => v3ToActivity(r)),
      })
      continue
    }

    for (const r of run) activities.push(v3ToActivity(r))
  }

  activities.sort(byTime)
  const location = acts[0]?.location || day.name.th || day.name.en || ''
  return { day: day.day, location, activities, choices, accommodation, accommodationChoices, transport: '' }
}

/** v1 days as-is; v2/v3 days converted to the v1 render shape. Empty array if no days.
 *  Also injects the traveler's flight (arrival → day 1, departure → last day). */
export function getRenderDays(itinerary: AnyItinerary | null | undefined): Day[] {
  if (!itinerary || typeof itinerary !== 'object') return []
  const base = isV3(itinerary)
    ? (itinerary.days ?? []).map(v3DayToRenderDay)
    : isV2(itinerary)
      ? (itinerary.days ?? []).map(v2DayToRenderDay)
      : Array.isArray((itinerary as Itinerary).days)
        ? (itinerary as Itinerary).days
        : []
  return applyFlight(base, (itinerary as { flight?: TripFlight | null }).flight)
}

// ── flight injection (arrival/departure rows from the traveler's input) ───────

export const AIRPORTS: Record<string, { label: string; transfer: string }> = {
  NRT: { label: 'Narita (NRT)', transfer: 'Narita Express / Skyliner → เข้าเมือง (~60–90 นาที)' },
  HND: { label: 'Haneda (HND)', transfer: 'Keikyu / Monorail → เข้าเมือง (~30 นาที)' },
  KIX: { label: 'Kansai (KIX)', transfer: 'Haruka → Kyoto (~75 นาที) / Nankai → Osaka (~45 นาที)' },
  NGO: { label: 'Chubu Centrair (NGO)', transfer: 'μ-Sky → Nagoya (~30 นาที)' },
  CTS: { label: 'New Chitose (CTS)', transfer: 'JR Rapid → Sapporo (~40 นาที)' },
  FUK: { label: 'Fukuoka (FUK)', transfer: 'Subway → Hakata (~5–10 นาที)' },
}

function airportInfo(airport?: string) {
  return airport ? AIRPORTS[airport.trim().toUpperCase()] : undefined
}

/** Assumed minutes to get from the airport to the day's first activity. A fixed
 *  default (varies by trip/transport, but ~2h keeps most plans from shifting). */
export const AIRPORT_TRANSFER_BUFFER_MIN = 120

function toMinutes(t?: string): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null
}

function fmtHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Parse "1.5h" / "45min" / "1h 30min" / "2 ชม." → minutes (0 if unknown). */
function durationMinutes(d?: string | null): number {
  if (!d) return 0
  let total = 0
  const h = d.match(/([\d.]+)\s*(?:h|hr|hour|ชม|ชั่วโมง)/i)
  const m = d.match(/([\d.]+)\s*(?:m|min|นาที)/i)
  if (h) total += parseFloat(h[1]) * 60
  if (m) total += parseFloat(m[1])
  return Math.round(total)
}

function activityEndTime(a: { time?: string | null; duration?: string | null }): string | undefined {
  const start = toMinutes(a.time ?? undefined)
  if (start == null) return undefined
  return fmtHHMM(start + durationMinutes(a.duration))
}

/** Latest END time among a day's activities (start + duration). */
export function lastActivityEndTime(activities: { time?: string | null; duration?: string | null }[]): string | undefined {
  return activities.reduce<string | undefined>((max, a) => {
    const e = activityEndTime(a)
    return e && (!max || e > max) ? e : max
  }, undefined)
}

/** Day 1 needs adjusting when the flight can't reach the first activity in time —
 *  i.e. arrival + transfer buffer ≥ the first activity (e.g. land 06:00 + 2h = 08:00
 *  ≥ an 08:00 start ⇒ too tight; land 05:00 ⇒ fine). */
export function arrivalTooLate(arrivalTime?: string, firstActivityTime?: string): boolean {
  const a = toMinutes(arrivalTime)
  const f = toMinutes(firstActivityTime)
  if (a == null || f == null) return false
  return a + AIRPORT_TRANSFER_BUFFER_MIN >= f
}

/** Check-in time before an international flight (4h if claiming a tax refund). */
export const CHECKIN_BUFFER_MIN = 180

/** Required gap from the last activity's END to the flight = travel-to-airport
 *  (reusing the transfer estimate, since we can't know the exact location) +
 *  check-in. ~5h with the defaults — powers a cautious reminder, not a hard rule. */
export const DEPARTURE_TIGHT_MIN = AIRPORT_TRANSFER_BUFFER_MIN + CHECKIN_BUFFER_MIN

/** Minutes from the last activity's END to the flight. `nextDay` (a red-eye /
 *  morning-after departure) adds 24h — so the day is EXACT, no clock guessing. */
function departureGap(lastActivityEnd?: string, departureTime?: string, nextDay?: boolean): number | null {
  const e = toMinutes(lastActivityEnd)
  const d = toMinutes(departureTime)
  if (e == null || d == null) return null
  return d + (nextDay ? 1440 : 0) - e
}

/** Not enough time after the last activity to make the flight (travel + check-in). */
export function departureTooTight(lastActivityEnd?: string, departureTime?: string, nextDay?: boolean): boolean {
  const gap = departureGap(lastActivityEnd, departureTime, nextDay)
  return gap != null && gap < DEPARTURE_TIGHT_MIN
}

/** Last activity falls AFTER the flight (a same-day flight earlier than the activity → impossible). */
export function departureIsAfter(lastActivityEnd?: string, departureTime?: string, nextDay?: boolean): boolean {
  const gap = departureGap(lastActivityEnd, departureTime, nextDay)
  return gap != null && gap < 0
}

function flightActivity(kind: 'arrival' | 'departure', leg: FlightLeg): Activity {
  const info = airportInfo(leg.airport)
  const place = info?.label ?? leg.airport?.trim()
  const verb = kind === 'arrival' ? 'ถึง' : 'ออกจาก'
  const name = place
    ? `${verb} ${place}`
    : kind === 'arrival' ? 'เที่ยวบินขาเข้า · Arrival' : 'เที่ยวบินขาออก · Departure'
  return {
    time: leg.time || '',
    name,
    emoji: kind === 'arrival' ? '🛬' : '🛫',
    category: 'flight',
    isLogistics: true,
    priority: 'mandatory',
    // Arrival → transfer-to-city hint; departure → check-in reminder (default).
    notes: kind === 'departure'
      ? 'เผื่อเดินทางไปสนามบิน ~2 ชม. + เช็คอินอย่างน้อย 3 ชม. (4 ชม. ถ้าขอคืนภาษี VAT)'
      : info?.transfer || undefined,
  }
}

const hasLeg = (leg?: FlightLeg) => !!leg && !!(leg.airport?.trim() || leg.time?.trim())

/** Bookend the trip with flights (non-mutating): arrival is ALWAYS the first
 *  item of day 1 and departure the LAST item of the final day — never time-sorted
 *  into the middle (a 15:00 arrival must not land after a 14:00 activity). When
 *  the arrival is later than the day's plan, the arrival row carries a "ปรับเวลา"
 *  note so the traveler knows to shift Day 1. */
function applyFlight(days: Day[], flight?: TripFlight | null): Day[] {
  if (!flight || days.length === 0) return days
  const out = days.slice()
  if (hasLeg(flight.arrival)) {
    const arr = flight.arrival!
    // First curated activity time (before we prepend the arrival row).
    const firstTime = out[0].activities.find((a) => a.time)?.time
    const day0: Day = { ...out[0], activities: [flightActivity('arrival', arr), ...out[0].activities] }
    // Can't reach the first activity in time (incl. airport-transfer buffer) →
    // flag it prominently (non-destructive; the traveler shifts Day 1 in My Trip).
    if (arrivalTooLate(arr.time, firstTime)) {
      day0.notice = `✈️ เครื่องถึง ${arr.time} น. + เผื่อเวลาเดินทางจากสนามบิน ~2 ชม. อาจไม่ทันแผนวันแรกที่เริ่ม ${firstTime} น. — ปรับได้ที่ My Trip`
    }
    out[0] = day0
  }
  if (hasLeg(flight.departure)) {
    const dep = flight.departure!
    const li = out.length - 1
    // When the LAST activity FINISHES (start + duration), on the last day.
    const lastEnd = lastActivityEndTime(out[li].activities)
    const lastDay: Day = { ...out[li], activities: [...out[li].activities, flightActivity('departure', dep)] }
    // Can't make the flight after the activity ends + travel + check-in?
    if (departureTooTight(lastEnd, dep.time, dep.nextDay)) {
      const tight = departureIsAfter(lastEnd, dep.time, dep.nextDay)
        ? `🛫 กิจกรรมสุดท้ายจบ ~${lastEnd} น. หลังเวลาบิน ${dep.time} น. — มีบางที่ไปไม่ได้แล้วครับ ลองปรับเวลา แก้ไข/ลบ/สลับกิจกรรม ที่ My Trip ดูนะครับ`
        : `🛫 กิจกรรมสุดท้ายจบ ~${lastEnd} น. — เผื่อเดินทางไปสนามบิน (~2 ชม.) + เช็คอิน (3 ชม. / 4 ชม. ถ้าขอคืนภาษี) อาจไม่ทันบิน ${dep.time} น. ลองปรับเวลา แก้ไข/ลบ/สลับกิจกรรม ที่ My Trip ดูนะครับ`
      lastDay.notice = [lastDay.notice, tight].filter(Boolean).join(' · ')
    }
    out[li] = lastDay
  }
  return out
}

// ── v1 → v2 migration (Phase N5) ─────────────────────────────────────────────

function activityToNode(a: Activity): NodeSnap {
  return {
    nodeId: null,
    name: a.name,
    nameTh: a.nameTh ?? null,
    categoryCode: codeForCategory(a.category),
    emoji: a.emoji ?? null,
    notes: a.notes ?? null,
    cost: a.cost ?? null,
    duration: a.duration ?? null,
    time: a.time || null,
    mapUrl: a.mapUrl ?? null,
  }
}

function detectMeal(label: string | undefined): MealKey | null {
  const l = (label ?? '').toLowerCase()
  for (const key of Object.keys(MEAL) as MealKey[]) {
    if (MEAL[key].kws.some((k) => l.includes(k))) return key
  }
  return null
}

function v1DayToV2Day(d: Day): DayV2 {
  const meals: Meals = { breakfast: null, lunch: null, dinner: null }
  const leftoverChoiceActs: Activity[] = []

  for (const c of d.choices ?? []) {
    const key = detectMeal(c.label)
    const slot: Slot = {
      kind: 'choice',
      label: c.label,
      selected: c.selected ?? null,
      options: (c.options ?? []).map(activityToNode),
    }
    if (key && !meals[key]) meals[key] = slot
    else {
      // Non-meal (or duplicate) choice → fall back to its selected/first option as an activity.
      const pick = c.options?.[c.selected ?? 0]
      if (pick) leftoverChoiceActs.push(pick)
    }
  }

  const activities = [...(d.activities ?? []), ...leftoverChoiceActs].map((a) => ({
    time: a.time || null,
    priority: a.priority,
    node: activityToNode(a),
  }))

  let accommodation: Slot | null = null
  if (d.accommodationChoices && d.accommodationChoices.length > 0) {
    accommodation = {
      kind: 'choice',
      options: d.accommodationChoices.map((o) => ({
        nodeId: null, name: o.name, categoryCode: 'live.stay.hotel',
        cost: o.cost ?? null, notes: o.notes ?? null,
      })),
    }
  } else if (d.accommodation) {
    accommodation = {
      kind: 'single',
      node: { nodeId: null, name: d.accommodation, categoryCode: 'live.stay.hotel' },
    }
  }

  const transport = d.transport
    ? [{
        from: null, to: null,
        notes: [d.transport, d.transportNotes].filter(Boolean).join(' · ') || null,
        node: null,
      }]
    : []

  return { day: d.day, location: d.location, free: d.free, meals, activities, accommodation, transport }
}

/** Convert a v1 itinerary to v2. Idempotent: returns v2 inputs unchanged. */
export function migrateV1toV2(itinerary: AnyItinerary): ItineraryV2 {
  if (isV2(itinerary)) return itinerary
  const v1 = itinerary as Itinerary
  return {
    version: 2,
    title: v1.title,
    totalDays: v1.totalDays ?? v1.days?.length,
    season: v1.season,
    shareCode: v1.shareCode ?? null,
    description: v1.description,
    days: (v1.days ?? []).map(v1DayToV2Day),
  }
}
