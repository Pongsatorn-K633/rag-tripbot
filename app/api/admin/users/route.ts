import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/authz'

/**
 * GET /api/admin/users
 * Lists every user with role, trip count, and creation date.
 * SUPERADMIN only.
 *
 * Hides the reserved `system@dopamichi.local` system user from the UI —
 * it's infrastructure, not a real account that should be visible to
 * admins for management.
 */
export async function GET() {
  try {
    await requireSuperAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const users = await prisma.user.findMany({
    where: {
      email: { not: 'system@dopamichi.local' },
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          trips: true,
          templates: true,
          accounts: true,
        },
      },
    },
    orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ users })
}
