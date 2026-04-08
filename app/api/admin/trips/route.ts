import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

/**
 * GET /api/admin/trips
 * Returns every Trip in the system with the owner's email + role and any
 * LINE contexts currently bound to it. ADMIN or SUPERADMIN only.
 *
 * Used by the admin dashboard to show a moderation table and to source
 * trips for the "Promote to template" action.
 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  // Two exclusions from All Trips:
  //
  //   1. System user bridge trips — invisible LINE activation infrastructure,
  //      not user content.
  //
  //   2. Template bookmarks (source='template') — when a user hearts a
  //      curated template, we create a Trip row as their personal bookmark.
  //      That's not user-generated content worth moderating — it's a
  //      duplicate of the admin's own published template. Excluding these
  //      keeps All Trips focused on the content that ACTUALLY needs
  //      moderation: uploads, chat generations, and originally-promoted
  //      source trips (which keep their original 'upload'/'chat' source,
  //      not 'template').
  const raw = await prisma.trip.findMany({
    where: {
      AND: [
        { user: { email: { not: 'system@dopamichi.local' } } },
        { NOT: { source: 'template' } },
      ],
    },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
      template: { select: { id: true, title: true } },
      activeChats: { select: { lineId: true, sourceType: true, updatedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Client-side safety filter — catches any edge case where the Prisma
  // NOT filter above doesn't exclude a row (e.g. Prisma's handling of
  // nullable fields with NOT can be surprising).
  const trips = raw.filter((t) => t.source !== 'template')

  console.log(
    `[admin/trips] returning ${trips.length} trips ` +
      `(raw from DB: ${raw.length}; sources: ${JSON.stringify(
        [...new Set(raw.map((t) => t.source))]
      )})`
  )

  return NextResponse.json({ trips })
}
