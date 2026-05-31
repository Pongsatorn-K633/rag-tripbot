import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

/**
 * GET /api/admin/jp-areas
 * Japan prefectures + regions for the trip-code province/region picker.
 */
export async function GET() {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
  const areas = await prisma.jpArea.findMany({ orderBy: { sortOrder: 'asc' } })
  return NextResponse.json({ areas })
}
