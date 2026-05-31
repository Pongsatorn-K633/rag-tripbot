import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { generateIncrementalTemplateCode } from '@/lib/share-code'

/**
 * GET /api/admin/templates/next-code?prefix=KYO
 * Preview the next incremental template code for a province/region prefix
 * (KYO-002 when KYO-001 already exists). Best-effort — the code is only actually
 * reserved when the template is created (the server mints uniquely on save).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }
  const prefix = req.nextUrl.searchParams.get('prefix')?.trim().toUpperCase()
  if (!prefix) return NextResponse.json({ error: 'prefix required' }, { status: 400 })

  const area = await prisma.jpArea.findUnique({ where: { code: prefix }, select: { code: true } })
  if (!area) return NextResponse.json({ error: 'unknown area' }, { status: 400 })

  const code = await generateIncrementalTemplateCode(prefix)
  return NextResponse.json({ code })
}
