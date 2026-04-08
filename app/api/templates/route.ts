import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/templates
 * Public endpoint — returns all published templates. Used by the templates
 * gallery page and (in the future) by the home-page browse card.
 */
export async function GET() {
  const templates = await prisma.template.findMany({
    where: { published: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      itinerary: true,
      coverImage: true,
      totalDays: true,
      season: true,
      shareCode: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ templates })
}
