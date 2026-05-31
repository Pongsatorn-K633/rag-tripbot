import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

const CATEGORY_SELECT = {
  code: true, root: true, category: true, subCategory: true, emoji: true,
} as const

function clean(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * PATCH /api/admin/nodes/:id
 * Partial update of a library node. Editing a node does NOT touch trips that
 * already snapshotted it (by design — see docs/node-architecture-spec.md).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { id } = await params
  const existing = await prisma.node.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Node not found' }, { status: 404 })

  const body = await req.json()
  const data: Prisma.NodeUpdateInput = {}

  if (body.name !== undefined) {
    const name = clean(body.name)
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    data.name = name
  }
  if (body.categoryCode !== undefined) {
    const categoryCode = clean(body.categoryCode)
    if (!categoryCode) return NextResponse.json({ error: 'categoryCode cannot be empty' }, { status: 400 })
    const cat = await prisma.category.findUnique({ where: { code: categoryCode }, select: { code: true } })
    if (!cat) return NextResponse.json({ error: `Unknown categoryCode: ${categoryCode}` }, { status: 400 })
    data.category = { connect: { code: categoryCode } }
  }
  if (body.nameTh !== undefined) data.nameTh = clean(body.nameTh)
  if (body.notes !== undefined) data.notes = clean(body.notes)
  if (body.cost !== undefined) data.cost = clean(body.cost)
  if (body.duration !== undefined) data.duration = clean(body.duration)
  if (body.mapUrl !== undefined) data.mapUrl = clean(body.mapUrl)
  if (body.city !== undefined) data.city = clean(body.city)

  const node = await prisma.node.update({
    where: { id },
    data,
    include: { category: { select: CATEGORY_SELECT } },
  })
  return NextResponse.json({ node })
}

/**
 * DELETE /api/admin/nodes/:id
 * Remove a node from the library. Trips that already snapshotted it are unaffected.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { id } = await params
  try {
    await prisma.node.delete({ where: { id } })
  } catch {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
