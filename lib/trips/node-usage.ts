import type { AnyItinerary, ItineraryV2, Slot, NodeSnap } from '@/lib/itinerary-types'
import { isV2 } from '@/lib/trips/itinerary-model'

/**
 * Node-usage helpers for the snapshot model (docs/node-architecture-spec.md).
 *
 * A trip embeds frozen NodeSnap copies, so node edits don't propagate
 * automatically. These walk a v2 itinerary's JSONB to (a) find which trips use a
 * library node and (b) re-snapshot the latest node data into them on demand.
 * v1 itineraries have no node snapshots → every function is a safe no-op.
 */

/** Node-derived fields refreshed on re-sync (NOT nodeId or the trip-specific time). */
export type NodeFields = Omit<NodeSnap, 'nodeId' | 'time'>

function slotNodes(slot: Slot | null | undefined): NodeSnap[] {
  if (!slot) return []
  return slot.kind === 'single' ? [slot.node] : slot.options
}

function mapSlot(slot: Slot | null, fn: (n: NodeSnap) => NodeSnap): Slot | null {
  if (!slot) return null
  if (slot.kind === 'single') return { ...slot, node: fn(slot.node) }
  return { ...slot, options: slot.options.map(fn) }
}

/** Every distinct library nodeId referenced by an itinerary (ad-hoc nodes excluded). */
export function collectNodeIds(itinerary: AnyItinerary): string[] {
  if (!isV2(itinerary)) return []
  const ids = new Set<string>()
  for (const d of itinerary.days ?? []) {
    for (const s of [d.meals?.breakfast, d.meals?.lunch, d.meals?.dinner, d.accommodation]) {
      for (const n of slotNodes(s)) if (n.nodeId) ids.add(n.nodeId)
    }
    for (const a of d.activities ?? []) if (a.node?.nodeId) ids.add(a.node.nodeId)
    for (const leg of d.transport ?? []) if (leg.node?.nodeId) ids.add(leg.node.nodeId)
  }
  return [...ids]
}

export function itineraryUsesNode(itinerary: AnyItinerary, nodeId: string): boolean {
  return collectNodeIds(itinerary).includes(nodeId)
}

/**
 * Return a copy of the itinerary with every NodeSnap of `nodeId` refreshed to
 * `fresh` (keeping its provenance `nodeId` + trip-specific `time`). `count` = how
 * many snapshots were replaced.
 */
export function resyncNodeInItinerary(
  itinerary: AnyItinerary,
  nodeId: string,
  fresh: NodeFields,
): { itinerary: AnyItinerary; count: number } {
  if (!isV2(itinerary)) return { itinerary, count: 0 }
  let count = 0
  const fix = (n: NodeSnap): NodeSnap => {
    if (n.nodeId !== nodeId) return n
    count++
    return { ...fresh, nodeId, time: n.time ?? null }
  }
  const v2 = itinerary as ItineraryV2
  const days = v2.days.map((d) => ({
    ...d,
    meals: {
      breakfast: mapSlot(d.meals?.breakfast ?? null, fix),
      lunch: mapSlot(d.meals?.lunch ?? null, fix),
      dinner: mapSlot(d.meals?.dinner ?? null, fix),
    },
    activities: (d.activities ?? []).map((a) => ({ ...a, node: fix(a.node) })),
    accommodation: mapSlot(d.accommodation, fix),
    transport: (d.transport ?? []).map((leg) => (leg.node ? { ...leg, node: fix(leg.node) } : leg)),
  }))
  return { itinerary: { ...v2, days }, count }
}
