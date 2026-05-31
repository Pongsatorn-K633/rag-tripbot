import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { syncBridgeTrip } from '@/lib/share-code'
import type { AnyItinerary } from '@/lib/itinerary-types'
import { itineraryUsesNode, resyncNodeInItinerary, type NodeFields } from '@/lib/trips/node-usage'

/**
 * GET  /api/admin/nodes/:id/usage  → templates whose itinerary snapshots this node.
 * POST /api/admin/nodes/:id/usage  → re-snapshot the latest node data into those
 *                                     templates (+ their LINE bridge trips).
 *
 * Templates only — user trips are intentionally frozen at duplication time.
 */

async function templatesUsing(nodeId: string) {
  const templates = await prisma.template.findMany({
    select: { id: true, title: true, shareCode: true, itinerary: true },
  })
  return templates.filter((t) => itineraryUsesNode(t.itinerary as unknown as AnyItinerary, nodeId))
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
  const { id } = await params
  const used = await templatesUsing(id)
  return NextResponse.json({ templates: used.map((t) => ({ id: t.id, title: t.title, shareCode: t.shareCode })) })
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
  const { id } = await params

  const node = await prisma.node.findUnique({
    where: { id },
    include: { category: { select: { emoji: true } } },
  })
  if (!node) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  const fresh: NodeFields = {
    name: node.name,
    nameTh: node.nameTh,
    categoryCode: node.categoryCode,
    emoji: node.category.emoji,
    notes: node.notes,
    cost: node.cost,
    duration: node.duration,
    mapUrl: node.mapUrl,
    placeId: node.placeId,
  }

  const used = await templatesUsing(id)
  let templatesUpdated = 0
  let snapshotsReplaced = 0

  for (const t of used) {
    const { itinerary, count } = resyncNodeInItinerary(t.itinerary as unknown as AnyItinerary, id, fresh)
    if (count === 0) continue
    await prisma.template.update({
      where: { id: t.id },
      data: { itinerary: itinerary as unknown as Prisma.InputJsonValue },
    })
    await syncBridgeTrip(t.id) // propagate to the LINE/LIFF bridge trip
    templatesUpdated++
    snapshotsReplaced += count
  }

  return NextResponse.json({ templatesUpdated, snapshotsReplaced })
}
