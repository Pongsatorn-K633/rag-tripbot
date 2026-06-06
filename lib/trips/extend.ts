import type { Itinerary, ItineraryV2, AnyItinerary, Day, DayV2 } from '@/lib/itinerary-types'

/**
 * Free-day padding for duplicated trips.
 *
 * When a user's chosen travel window is LONGER than a pre-planned trip, we keep
 * the curated days and append labeled "free days" so the trip spans their full
 * dates. They flesh those days out later in My Trip. Pure module — no DB, no
 * React — so both the web duplicate flow and the (future) LIFF duplicate can use it.
 *
 * Version-aware: a v2 (node/slot) itinerary gets v2-shaped free days (with the
 * canonical `meals` keys + `transport: []`), so the v2 renderer never trips over
 * a v1-shaped day.
 */

/** A blank, labeled v1 free day. */
export function makeFreeDay(dayNum: number): Day {
  return {
    day: dayNum,
    location: 'วันอิสระ',
    free: true,
    activities: [],
    accommodation: null,
    transport: '',
  }
}

/** A blank, labeled v2 free day (matches DayV2 — meals keys present, transport array). */
export function makeFreeDayV2(dayNum: number): DayV2 {
  return {
    day: dayNum,
    location: 'วันอิสระ',
    free: true,
    meals: { breakfast: null, lunch: null, dinner: null },
    activities: [],
    accommodation: null,
    transport: [],
  }
}

/**
 * Return a copy of `itin` padded with free days until it spans `targetDays`.
 * Never truncates: if `targetDays` ≤ the existing day count, returns it unchanged.
 * `totalDays` is updated to match the new length.
 */
export function extendItineraryWithFreeDays(itin: AnyItinerary, targetDays: number): AnyItinerary {
  const existing = itin.days.length
  if (targetDays <= existing) return itin

  if ((itin as ItineraryV2).version === 2) {
    const v2 = itin as ItineraryV2
    const extra: DayV2[] = []
    for (let n = existing + 1; n <= targetDays; n++) extra.push(makeFreeDayV2(n))
    return { ...v2, days: [...v2.days, ...extra], totalDays: targetDays }
  }

  const v1 = itin as Itinerary
  const extra: Day[] = []
  for (let n = existing + 1; n <= targetDays; n++) extra.push(makeFreeDay(n))
  return { ...v1, days: [...v1.days, ...extra], totalDays: targetDays }
}

/**
 * "Make Day 1 a free arrival day" — for a late flight. Keeps the SAME number of
 * days: prepend a free arrival day, and drop one day to compensate —
 *   - if the LAST day is already free → drop it (no curated content lost; the
 *     spare day just moves to the front);
 *   - otherwise → drop the old Day 1's plan (you arrived too late to run it).
 * The trip never grows past the days the traveler booked.
 */
/** True when the trip has a spare free day at the end — i.e. the traveler booked
 *  more days than the plan. Used to decide whether "make Day 1 free" shifts the
 *  plan (no loss) or replaces Day 1 (loses its plan). */
export function hasTrailingFreeDay(itin: AnyItinerary): boolean {
  const days = itin.days
  return !!days?.length && !!(days[days.length - 1] as { free?: boolean }).free
}

export function makeDayOneFree(itin: AnyItinerary): AnyItinerary {
  if (!itin.days || itin.days.length === 0) return itin
  const lastIsFree = hasTrailingFreeDay(itin)

  if ((itin as ItineraryV2).version === 2) {
    const v2 = itin as ItineraryV2
    const rest = lastIsFree ? v2.days.slice(0, -1) : v2.days.slice(1)
    const days = [makeFreeDayV2(1), ...rest].map((d, i) => ({ ...d, day: i + 1 }))
    return { ...v2, days, totalDays: days.length }
  }
  const v1 = itin as Itinerary
  const rest = lastIsFree ? v1.days.slice(0, -1) : v1.days.slice(1)
  const days = [makeFreeDay(1), ...rest].map((d, i) => ({ ...d, day: i + 1 }))
  return { ...v1, days, totalDays: days.length }
}
