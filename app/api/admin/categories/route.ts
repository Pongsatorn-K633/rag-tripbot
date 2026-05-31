import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

/**
 * GET /api/admin/categories
 * Full taxonomy for the Node-library category picker (ordered root → sortOrder).
 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
  const categories = await prisma.category.findMany({
    orderBy: [{ root: 'asc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json({ categories })
}
