import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

/**
 * GET /api/admin/trips
 * Returns every real user Trip with owner info + LINE contexts.
 * ADMIN or SUPERADMIN only.
 *
 * Includes ALL user trips (upload, chat, AND template-sourced) so admins
 * can see which users have generated LINE codes, even for personalized
 * template copies. Only excludes system bridge trips (infrastructure).
 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const trips = await prisma.trip.findMany({
    where: {
      // Only exclude system user's bridge trips (LINE activation infra).
      // Real user trips of ALL sources (upload, chat, template) are shown
      // so admins can see generated codes + moderation content.
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
