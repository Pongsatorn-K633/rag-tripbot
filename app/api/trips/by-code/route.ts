import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
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
