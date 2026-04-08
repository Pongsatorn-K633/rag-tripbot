import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

function generateCode(city: string): string {
  const prefix = city.slice(0, 3).toUpperCase()
  const number = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${number}`
}

/**
 * POST /api/activate
 * Generates (or reuses) a shareCode for the given trip. Only the trip owner
 * can activate — ADMINs intentionally CANNOT generate share codes for trips
 * they don't own (sharing is an owner-controlled action, not moderation).
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tripId, primaryCity } = await req.json()
  if (!tripId) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 })
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }
  if (trip.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If the trip already has a shareCode, just return it — idempotent.
  if (trip.shareCode) {
    return NextResponse.json({ shareCode: trip.shareCode })
  }

  let shareCode = generateCode(primaryCity ?? 'JPN')
  let exists = await prisma.trip.findUnique({ where: { shareCode } })
  while (exists) {
    shareCode = generateCode(primaryCity ?? 'JPN')
    exists = await prisma.trip.findUnique({ where: { shareCode } })
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: { shareCode },
  })

  return NextResponse.json({ shareCode: updated.shareCode })
}
