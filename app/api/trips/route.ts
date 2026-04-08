import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

/**
 * POST /api/trips
 * Save a new trip for the authenticated user. Identity comes from the session,
 * NEVER from the request body (the old userId-in-body pattern was removed when
 * auth was added — clients no longer need to send a userId).
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'กรุณาเข้าสู่ระบบเพื่อบันทึกทริป · Please sign in to save trips' },
      { status: 401 }
    )
  }

  const { title, itinerary, startDate, source, templateId } = await req.json()

  if (!title || !itinerary) {
    return NextResponse.json(
      { error: 'title and itinerary are required' },
      { status: 400 }
    )
  }

  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,
      title,
      itinerary,
      startDate: startDate ? new Date(startDate) : undefined,
      source: source ?? undefined,
      templateId: templateId ?? undefined,
    },
  })

  return NextResponse.json({ trip })
}

/**
 * GET /api/trips
 * List the authenticated user's own trips. Guests receive an empty array
 * (not a 401) so the gallery UI can render an empty state cleanly.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ trips: [] })
  }

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ trips })
}
