import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/templates/:id
 * Public endpoint — the full itinerary of ONE published template. Fetched on
 * demand when a gallery card is opened (PlanPreviewModal); the list endpoint
 * (GET /api/templates) deliberately omits the itinerary for payload size.
 */
// Cached per-URL like the list route — same 5-minute authoring staleness.
export const revalidate = 300

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const template = await prisma.template.findFirst({
    where: { id, published: true },
    select: { id: true, itinerary: true },
  })
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }
  return NextResponse.json({ template })
}
