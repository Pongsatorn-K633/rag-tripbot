import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

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

  const template = await prisma.template.update({
    where: { id },
    data: {
      title: body.title ?? undefined,
      description: body.description ?? undefined,
      itinerary: body.itinerary ?? undefined,
      coverImage: body.coverImage ?? undefined,
      totalDays: body.totalDays ?? undefined,
      season: body.season ?? undefined,
      published: typeof body.published === 'boolean' ? body.published : undefined,
    },
  })

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
