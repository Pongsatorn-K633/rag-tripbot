import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { generateShareCodeForTemplate, getSystemUserId } from '@/lib/share-code'
import { parseAvailabilityInput } from '@/lib/availability'

/**
 * GET /api/admin/templates
 * Returns ALL templates (published + unpublished) with author details.
 * Used by the admin dashboard.
 */
export async function GET() {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  // Template.shareCode is the canonical LINE code, same for all admins.
  // Auto-backfill any templates created before this field existed so every
  // card in the dashboard shows a working code from the first load.
  const templates = await prisma.template.findMany({
    include: {
      createdBy: { select: { id: true, email: true, name: true } },
      _count: { select: { savedAs: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const needBackfill = templates.filter((t) => !t.shareCode)
  if (needBackfill.length > 0) {
    const systemUserId = await getSystemUserId()
    for (const t of needBackfill) {
      try {
        const code = await generateShareCodeForTemplate(t.id, systemUserId)
        t.shareCode = code
      } catch (err) {
        console.error(`[admin/templates] backfill failed for ${t.id}:`, err)
      }
    }
  }

  return NextResponse.json({ templates })
}

/**
 * POST /api/admin/templates
 * Creates a new template from a form payload. Created by the signed-in
 * admin (not the system user).
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
  const { title, description, itinerary, coverImage, totalDays, season, published = true, provinceCode } = body

  if (!title || !itinerary || typeof totalDays !== 'number') {
    return NextResponse.json(
      { error: 'title, itinerary, totalDays are required' },
      { status: 400 }
    )
  }

  // A template code's prefix can only be a real Japan area (JpArea) — validate
  // against the DB so it's never a free-typed value. Optional: no prefix ⇒
  // generateShareCodeForTemplate falls back to a city-derived crypto code.
  let prefix: string | undefined
  if (typeof provinceCode === 'string' && provinceCode.trim()) {
    prefix = provinceCode.trim().toUpperCase()
    const area = await prisma.jpArea.findUnique({ where: { code: prefix }, select: { code: true } })
    if (!area) {
      return NextResponse.json(
        { error: `ไม่พบรหัสพื้นที่ "${prefix}" ในระบบ · Unknown area code` },
        { status: 400 }
      )
    }
  }

  let availability
  try {
    availability = parseAvailabilityInput(body.availability)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid availability' },
      { status: 400 }
    )
  }

  const template = await prisma.template.create({
    data: {
      title,
      description: description ?? null,
      itinerary,
      coverImage: coverImage ?? null,
      totalDays,
      season: season ?? null,
      availability: availability
        ? (availability as unknown as Prisma.InputJsonValue)
        : undefined,
      published,
      createdById: session.user.id,
    },
  })

  // Auto-generate the canonical share code + LINE bridge trip at creation
  // time so admins never see a template without a code.
  try {
    const systemUserId = await getSystemUserId()
    const shareCode = await generateShareCodeForTemplate(template.id, systemUserId, prefix)
    template.shareCode = shareCode
  } catch (err) {
    console.error('[admin/templates] share code generation failed:', err)
  }

  return NextResponse.json({ template })
}
