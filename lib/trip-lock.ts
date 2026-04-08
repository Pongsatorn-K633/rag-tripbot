import { prisma } from './db'

/**
 * Trip "lock" logic — protects trips that have been promoted into published
 * templates from accidental deletion by their original owner.
 *
 * The lock is implicit: a trip is locked if any Template's `shareCode`
 * matches the trip's own `shareCode`. When an admin promotes a trip, the
 * promote route (app/api/admin/templates/from-trip/[tripId]/route.ts) copies
 * the trip's shareCode to the template's shareCode, creating the lock
 * automatically. No back-reference column needed.
 *
 * Users who try to delete a locked trip get a 409 with a pointer to /support.
 * Admins can still delete (with a warning), which nulls out the template's
 * shareCode — the next dashboard load will backfill a fresh code + bridge
 * trip via the helper in lib/share-code.ts.
 */

export interface TripLockInfo {
  locked: boolean
  /** The Template whose shareCode matches this trip's shareCode, if any */
  lockedBy: { id: string; title: string } | null
}

/**
 * Check whether a single trip is locked by any published template.
 */
export async function getTripLockInfo(tripId: string): Promise<TripLockInfo> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { shareCode: true },
  })
  if (!trip?.shareCode) return { locked: false, lockedBy: null }

  const template = await prisma.template.findUnique({
    where: { shareCode: trip.shareCode },
    select: { id: true, title: true },
  })
  if (!template) return { locked: false, lockedBy: null }

  return { locked: true, lockedBy: { id: template.id, title: template.title } }
}

/**
 * For a batch of trips, return a Map<tripId, boolean> indicating which ones
 * are locked. Used by GET /api/trips to annotate the user's gallery list in
 * a single round-trip instead of N+1 queries.
 */
export async function getLockedTripIds(tripShareCodes: string[]): Promise<Set<string>> {
  const codes = tripShareCodes.filter(Boolean)
  if (codes.length === 0) return new Set()

  const templates = await prisma.template.findMany({
    where: { shareCode: { in: codes } },
    select: { shareCode: true },
  })

  return new Set(
    templates.map((t) => t.shareCode).filter((c): c is string => !!c)
  )
}
