import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId, title, itinerary, startDate, source } = await req.json()

  if (!userId || !title || !itinerary) {
    return NextResponse.json(
      { error: 'userId, title, and itinerary are required' },
      { status: 400 }
    )
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  })

  const trip = await prisma.trip.create({
    data: {
      userId,
      title,
      itinerary,
      startDate: startDate ? new Date(startDate) : undefined,
      source: source ?? undefined,
    },
  })

  return NextResponse.json({ trip })
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ trips })
}
