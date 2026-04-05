import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function generateCode(city: string): string {
  const prefix = city.slice(0, 3).toUpperCase()
  const number = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${number}`
}

export async function POST(req: NextRequest) {
  const { tripId, primaryCity } = await req.json()

  if (!tripId) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 })
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
