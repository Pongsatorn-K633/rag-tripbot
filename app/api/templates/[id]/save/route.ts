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

  // Dedupe — if the user already has a Trip for this template, return it.
  const existing = await prisma.trip.findFirst({
    where: { userId: session.user.id, templateId },
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
 * "Un-heart" a template — deletes any Trip rows the user has for this
 * template. Cascade deletes any linked LineContexts.
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

  const result = await prisma.trip.deleteMany({
    where: { userId: session.user.id, templateId },
  })

  return NextResponse.json({ ok: true, deleted: result.count })
}
