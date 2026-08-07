import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { safeHref } from '@/lib/url'
import type { Itinerary } from '@/lib/itinerary-types'

/**
 * Shared trip-edit core — used by BOTH the web edit route (NextAuth session) and
 * the LIFF edit route (LINE identity). The two surfaces differ only in how they
 * resolve the owning `userId`; the validation + persistence below is identical.
 *
 * "Light edits": pick choices, set start date, reorder/remove activities, add
 * notes. The editor sends back the full itinerary JSON, which we validate
 * structurally before saving (never trust client-supplied JSON blindly).
 */

export class TripEditError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'TripEditError'
  }
}

/**
 * Every key in the itinerary whose value is rendered as an `href`, across all
 * three schema versions: V3 `links` (map/walking_route/ig/fb/tt/website) and the
 * v1/v2 flat pair. Keep in sync with the render sinks in ItineraryView /
 * TripPreviewPanels.
 */
const URL_KEYS = new Set([
  'map',
  'walking_route',
  'ig',
  'fb',
  'tt',
  'website',
  'mapUrl',
  'walkingUrl',
])

/**
 * Neutralize dangerous URL schemes anywhere in the itinerary, in place of the
 * value (`javascript:`/`data:`/`vbscript:` → null).
 *
 * Deliberately a SCRUB, not a normalization: a user's trip is their own
 * document — a copy that no longer answers to the template it came from — so
 * this must not reshape, drop or re-key anything else. It walks the whole tree
 * rather than the known V3 path, because that's the only version-agnostic way to
 * catch a link the shape check doesn't know about.
 *
 * `safeHref` at the render boundary stays as defence in depth; this closes the
 * hole one layer earlier, so a bad link is never stored in the first place.
 */
export function scrubItineraryUrls<T>(node: T): T {
  if (Array.isArray(node)) return node.map((n) => scrubItineraryUrls(n)) as unknown as T
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (URL_KEYS.has(key) && typeof value === 'string') {
      out[key] = safeHref(value) ?? null
    } else {
      out[key] = scrubItineraryUrls(value)
    }
  }
  return out as T
}

/** Structural validation — keeps the itinerary contract intact on write. */
export function validateItinerary(raw: unknown): Itinerary {
  if (!raw || typeof raw !== 'object') throw new TripEditError(400, 'itinerary must be an object')
  const itin = raw as Itinerary
  if (!Array.isArray(itin.days)) throw new TripEditError(400, 'itinerary.days must be an array')
  for (const d of itin.days) {
    if (!d || typeof d.day !== 'number') throw new TripEditError(400, 'each day needs a numeric `day`')
    if (!Array.isArray(d.activities)) throw new TripEditError(400, 'each day needs an `activities` array')
    for (const a of d.activities) {
      // v1 activity has string `name`; v2 wraps a node (`node.name`); v3 uses a
      // bilingual `name` object `{ en, th }`.
      const v1Named = !!a && typeof (a as { name?: unknown }).name === 'string'
      const node = a && (a as { node?: { name?: unknown } }).node
      const v2Named = !!node && typeof node.name === 'string'
      const n3 = a && (a as { name?: { en?: unknown; th?: unknown } }).name
      const v3Named = !!n3 && typeof n3 === 'object' && (typeof n3.en === 'string' || typeof n3.th === 'string')
      if (!v1Named && !v2Named && !v3Named) throw new TripEditError(400, 'each activity needs a `name` (v1/v3) or `node.name` (v2)')
    }
    if (d.choices !== undefined && !Array.isArray(d.choices)) {
      throw new TripEditError(400, '`choices` must be an array when present')
    }
  }
  return itin
}

interface EditInput {
  itinerary?: unknown
  startDate?: string | null
  title?: string
}

/**
 * Apply light edits to a trip after verifying the requester owns it.
 * `ownerUserId` is the resolved User id (web session user OR LINE shadow user).
 * Throws TripEditError(404|403|400) on missing trip / wrong owner / bad input.
 */
export async function updateTripItinerary(
  tripId: string,
  ownerUserId: string,
  input: EditInput
) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) throw new TripEditError(404, 'Trip not found')
  if (trip.userId !== ownerUserId) throw new TripEditError(403, 'You do not own this trip')

  const data: Prisma.TripUpdateInput = {}
  if (input.itinerary !== undefined) {
    // Shape first (rejects nonsense), then scrub hrefs (accepts the document as
    // the user shaped it, minus unsafe URL schemes).
    const validated = validateItinerary(input.itinerary)
    data.itinerary = scrubItineraryUrls(validated) as unknown as Prisma.InputJsonValue
  }
  if (input.startDate !== undefined) {
    data.startDate = input.startDate ? new Date(input.startDate) : null
  }
  if (typeof input.title === 'string' && input.title.trim()) {
    data.title = input.title.trim()
  }

  return prisma.trip.update({ where: { id: tripId }, data })
}
