import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { codeLookupRateLimit, checkLimit, getClientIp } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  // Public, unauthenticated read path → throttle by IP so the share code can't
  // be enumerated over plain HTTP (it's a bearer read-token for the itinerary).
  const { success } = await checkLimit(codeLookupRateLimit, getClientIp(req))
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const shareCode = req.nextUrl.searchParams.get('shareCode')
  if (!shareCode) {
    return NextResponse.json({ error: 'shareCode required' }, { status: 400 })
  }

  const trip = await prisma.trip.findUnique({ where: { shareCode } })
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  return NextResponse.json({
    itinerary: trip.itinerary,
    startDate: trip.startDate ?? null,
    totalDays: (trip.itinerary as { totalDays?: number } | null)?.totalDays ?? null,
  })
}
