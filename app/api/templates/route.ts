import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/templates
 * Public endpoint — returns all published templates. Used by the home page,
 * /discover, /saved, and the LIFF pre-planned gallery.
 *
 * Deliberately EXCLUDES the `itinerary` jsonb (~86 KB per trip): the galleries
 * only render card fields, and the one opened trip's full itinerary is fetched
 * on demand from GET /api/templates/[id] (see PlanPreviewModal).
 */
// Cache the response (Full Route Cache; Vercel's ISR cache in prod) — trip
// content changes only when an admin authors, so 5-minute staleness is fine
// and every visitor in the window skips the DB round-trip entirely.
export const revalidate = 300

export async function GET() {
  const templates = await prisma.template.findMany({
    where: { published: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      coverImage: true,
      coverImages: true,
      totalDays: true,
      season: true,
      availability: true,
      shareCode: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ templates })
}
