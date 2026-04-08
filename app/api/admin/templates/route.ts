import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { generateShareCodeForTemplate, getSystemUserId } from '@/lib/share-code'

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
  const { title, description, itinerary, coverImage, totalDays, season, published = true } = body

  if (!title || !itinerary || typeof totalDays !== 'number') {
    return NextResponse.json(
      { error: 'title, itinerary, totalDays are required' },
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
      published,
      createdById: session.user.id,
    },
  })

  // Auto-generate the canonical share code + LINE bridge trip at creation
  // time so admins never see a template without a code.
  try {
    const systemUserId = await getSystemUserId()
    const shareCode = await generateShareCodeForTemplate(template.id, systemUserId)
    template.shareCode = shareCode
  } catch (err) {
    console.error('[admin/templates] share code generation failed:', err)
  }

  return NextResponse.json({ template })
}
