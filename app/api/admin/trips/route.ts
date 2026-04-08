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

  // Exclude the system user's "bridge" trips — those are invisible
  // infrastructure for LINE share-code activation, not real user content.
  const trips = await prisma.trip.findMany({
    where: {
      user: { email: { not: 'system@dopamichi.local' } },
    },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
      template: { select: { id: true, title: true } },
      activeChats: { select: { lineId: true, sourceType: true, updatedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ trips })
}
