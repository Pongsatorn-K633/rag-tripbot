import type { Itinerary, Day } from '@/lib/itinerary-types'

/**
 * Free-day padding for duplicated trips.
 *
 * When a user's chosen travel window is LONGER than a pre-planned trip, we keep
 * the curated days and append labeled "free days" so the trip spans their full
 * dates. They flesh those days out later in My Trip. Pure module — no DB, no
 * React — so both the web duplicate flow and the (future) LIFF duplicate can use it.
 */

/** A blank, labeled free day the user can plan themselves. */
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

/**
 * Return a copy of `itin` padded with free days until it spans `targetDays`.
 * Never truncates: if `targetDays` ≤ the existing day count, returns it unchanged.
 * `totalDays` is updated to match the new length.
 */
export function extendItineraryWithFreeDays(itin: Itinerary, targetDays: number): Itinerary {
  const existing = itin.days.length
  if (targetDays <= existing) return itin
  const extra: Day[] = []
  for (let n = existing + 1; n <= targetDays; n++) extra.push(makeFreeDay(n))
  return { ...itin, days: [...itin.days, ...extra], totalDays: targetDays }
}
