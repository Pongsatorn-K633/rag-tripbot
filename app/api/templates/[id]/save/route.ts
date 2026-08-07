import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * POST /api/templates/:id/save
 * "Heart" a template — creates a Trip row with source='template' and
 * templateId set. Idempotent: if the user already saved this template,
 * returns the existing Trip instead of creating a duplicate.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: templateId } = await params
  const tmpl = await prisma.template.findUnique({ where: { id: templateId } })
  if (!tmpl || !tmpl.published) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // Dedupe — if the user already HEARTED this template, return that Trip.
  //
  // `source: 'template'` is load-bearing, not decoration. A user who duplicated
  // this template into their own editable copy has a Trip with the same
  // templateId but source='plan'. Without this filter that copy matched here,
  // the route returned alreadySaved:true, and NO heart row was ever created —
  // so the heart reverted on the next load (the "did not save" bug). The read
  // side (useSavedTemplates) has always keyed on source==='template'; this is
  // the write side finally agreeing with it.
  const existing = await prisma.trip.findFirst({
    where: { userId: session.user.id, templateId, source: 'template' },
  })
  if (existing) {
    return NextResponse.json({ trip: existing, alreadySaved: true })
  }

  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,
      title: tmpl.title,
      itinerary: tmpl.itinerary as object,
      source: 'template',
      templateId: tmpl.id,
    },
  })

  return NextResponse.json({ trip, alreadySaved: false })
}

/**
 * DELETE /api/templates/:id/save
 * "Un-heart" a template — deletes the user's HEARTED Trip rows for it
 * (source='template'). Cascade deletes any linked LineContexts.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: templateId } = await params

  // source: 'template' scopes this to HEARTS only. Without it, un-hearting a
  // template also deleted the user's DUPLICATED copy of it (same templateId,
  // source='plan') — their own edits, dates and share code, gone from one tap
  // on a heart they may not even have set themselves.
  const result = await prisma.trip.deleteMany({
    where: { userId: session.user.id, templateId, source: 'template' },
  })

  return NextResponse.json({ ok: true, deleted: result.count })
}
