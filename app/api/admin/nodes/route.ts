import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

/** Category fields denormalized onto each node row for rendering without a join. */
const CATEGORY_SELECT = {
  code: true, root: true, category: true, subCategory: true, emoji: true,
} as const

/** Trimmed string, or null for empty/non-string. */
function clean(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * GET /api/admin/nodes?q=&categoryCode=&root=&city=
 * Search/filter the node library. Admin-only.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const sp = req.nextUrl.searchParams
  const q = sp.get('q')?.trim()
  const categoryCode = sp.get('categoryCode')?.trim()
  const root = sp.get('root')?.trim()
  const city = sp.get('city')?.trim()

  const where: Prisma.NodeWhereInput = {}
  if (categoryCode) where.categoryCode = categoryCode
  if (root) where.category = { root }
  if (city) where.city = { equals: city, mode: 'insensitive' }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { nameTh: { contains: q } },
      { city: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
    ]
  }

  const nodes = await prisma.node.findMany({
    where,
    include: { category: { select: CATEGORY_SELECT } },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })
  return NextResponse.json({ nodes })
}

/**
 * POST /api/admin/nodes
 * Create a library node. `name` + `categoryCode` (must exist) required.
 */
export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const body = await req.json()
  const name = clean(body.name)
  const categoryCode = clean(body.categoryCode)
  if (!name || !categoryCode) {
    return NextResponse.json({ error: 'name and categoryCode are required' }, { status: 400 })
  }
  const cat = await prisma.category.findUnique({ where: { code: categoryCode }, select: { code: true } })
  if (!cat) {
    return NextResponse.json({ error: `Unknown categoryCode: ${categoryCode}` }, { status: 400 })
  }

  const node = await prisma.node.create({
    data: {
      name,
      nameTh: clean(body.nameTh),
      categoryCode,
      notes: clean(body.notes),
      cost: clean(body.cost),
      duration: clean(body.duration),
      mapUrl: clean(body.mapUrl),
      city: clean(body.city),
      createdById: session.user.id,
    },
    include: { category: { select: CATEGORY_SELECT } },
  })
  return NextResponse.json({ node })
}
