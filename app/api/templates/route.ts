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
  const rows = await prisma.template.findMany({
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
      // Read ONLY to pull overview.cover_places out below — the jsonb is
      // dropped before responding, so the client payload stays ~1 KB. The DB
      // read is per revalidation (5 min), not per visitor.
      itinerary: true,
    },
  })

  // Per-cover place captions, keyed by index to `coverImages`. V3 only; v1/v2
  // itineraries simply have none and their cards render no caption.
  const templates = rows.map(({ itinerary, ...t }) => {
    const ov = (itinerary as { overview?: { cover_places?: string[]; card_tilt?: string } } | null)
      ?.overview
    return { ...t, coverPlaces: ov?.cover_places ?? [], cardTilt: ov?.card_tilt ?? null }
  })

  return NextResponse.json({ templates })
}
