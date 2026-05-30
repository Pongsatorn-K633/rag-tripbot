import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { parseAvailabilityInput } from '@/lib/availability'
import { syncBridgeTrip } from '@/lib/share-code'

/**
 * PATCH /api/admin/templates/:id
 * Edit a template — any subset of fields can be updated. Commonly used
 * to toggle the `published` flag.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { id } = await params
  const body = await req.json()

  // availability: only touch it if the key is present. A normalized null means
  // "always available" → store DB NULL; an object stores the validated ranges.
  let availability: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined
  if ('availability' in body) {
    try {
      const parsed = parseAvailabilityInput(body.availability)
      availability = parsed ? (parsed as unknown as Prisma.InputJsonValue) : Prisma.DbNull
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid availability' },
        { status: 400 }
      )
    }
  }

  const template = await prisma.template.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      itinerary: body.itinerary ?? undefined,
      coverImage: body.coverImage ?? undefined,
      totalDays: body.totalDays ?? undefined,
      season: body.season ?? undefined,
      availability,
      published: typeof body.published === 'boolean' ? body.published : undefined,
    },
  })

  // Keep the LINE/LIFF bridge trip's content in sync with the edited template
  // so /activate and the pre-planned cards never show stale itineraries.
  if (body.itinerary !== undefined || body.title !== undefined || body.coverImage !== undefined) {
    try {
      await syncBridgeTrip(id)
    } catch (err) {
      console.error('[admin/templates] bridge sync failed:', err)
    }
  }

  return NextResponse.json({ template })
}

/**
 * DELETE /api/admin/templates/:id
 * Permanently delete a template. Trips that were saved from this template
 * stay around (templateId FK is ON DELETE SET NULL) so users don't lose
 * their saved copies, they just become orphans.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { id } = await params
  await prisma.template.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
