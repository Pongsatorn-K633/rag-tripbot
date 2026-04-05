import { NextRequest, NextResponse } from 'next/server'
import { extractTripParams } from '@/lib/rag/extractor'
import { assembleItinerary } from '@/lib/rag/assembler'

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }

  try {
    const params = await extractTripParams(message)

    if (!params.month || !params.duration) {
      return NextResponse.json({
        reply: 'ช่วยบอกเดือนที่อยากไปและจำนวนวันด้วยนะคะ',
        itinerary: null,
      })
    }

    const itinerary = await assembleItinerary(params, message)

    return NextResponse.json({
      reply: 'นี่คือแผนการเดินทางของคุณค่ะ! ต้องการปรับแก้อะไรไหม?',
      itinerary,
      warning: params.warning ?? null,
    })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'Failed to generate itinerary' }, { status: 500 })
  }
}
