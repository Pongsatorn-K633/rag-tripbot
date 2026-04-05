import { NextRequest, NextResponse } from 'next/server'
import { validateSignature, webhook } from '@line/bot-sdk'
import { prisma } from '@/lib/db'
import { parseEvent } from '@/lib/line/parser'
import { replyToLine, pushToLine } from '@/lib/line/client'
import { answerWithContext, answerWithEnrichedContext, saveChatHistory, type ChatMessage } from '@/lib/line/injector'

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-line-signature') ?? ''
  const body = await req.text()

  const channelSecret = process.env.LINE_CHANNEL_SECRET!
  if (!validateSignature(body, channelSecret, signature)) {
    return NextResponse.json({ error: 'ลายเซ็นไม่ถูกต้อง' }, { status: 403 })
  }

  const parsed: { events: webhook.Event[] } = JSON.parse(body)

  await Promise.all(parsed.events.map(handleEvent))

  return NextResponse.json({ ok: true })
}

async function handleEvent(event: webhook.Event) {
  const parsedEvent = parseEvent(event)
  if (!parsedEvent || parsedEvent.type !== 'text' || !parsedEvent.text) return

  const { lineId, sourceType, replyToken, text } = parsedEvent

  if (text.toLowerCase().startsWith('/activate')) {
    await handleActivate(lineId, sourceType, replyToken, text)
    return
  }

  await handleQuestion(lineId, replyToken, text)
}

async function handleActivate(
  lineId: string,
  sourceType: 'user' | 'group',
  replyToken: string,
  text: string
) {
  const parts = text.split(' ')
  const shareCode = parts[1]?.toUpperCase()

  if (!shareCode) {
    await replyToLine(replyToken, 'กรุณาระบุรหัสเปิดใช้งาน เช่น: /activate TKY-492')
    return
  }

  const trip = await prisma.trip.findUnique({ where: { shareCode } })

  if (!trip) {
    await replyToLine(
      replyToken,
      `ไม่พบแผนการเดินทางรหัส ${shareCode} กรุณาตรวจสอบรหัสอีกครั้ง`
    )
    return
  }

  await prisma.lineContext.upsert({
    where: { lineId },
    update: { trip: { connect: { id: trip.id } }, sourceType, chatHistory: [], updatedAt: new Date() },
    create: { lineId, sourceType, tripId: trip.id },
  })

  await replyToLine(
    replyToken,
    `สวัสดี! 🌸 เราดึงข้อมูลแพลนเที่ยวญี่ปุ่นของคุณมาเรียบร้อยแล้ว "${trip.title}" ผมพร้อมตอบทุกข้อสงสัยในรูทนี้ พิมพ์คำถามของคุณมาได้เลย!`
  )
}

async function handleQuestion(lineId: string, replyToken: string, text: string) {
  const context = await prisma.lineContext.findUnique({
    where: { lineId },
    include: { trip: true },
  })

  if (!context) {
    await replyToLine(
      replyToken,
      'ยังไม่ได้เปิดใช้งานแผนการเดินทาง กรุณาพิมพ์ /activate [รหัส] ก่อนนะคะ'
    )
    return
  }

  const itinerary = context.trip.itinerary as object
  const chatHistory = (context.chatHistory as ChatMessage[] | null) ?? []
  const result = await answerWithContext(text, itinerary, chatHistory)

  if (!result.needsFollowUp) {
    // Fast path — answer from itinerary was sufficient
    await replyToLine(replyToken, result.answer)
    await saveChatHistory(lineId, text, result.answer)
    return
  }

  // Slow path — tell user we're searching, then push enriched answer
  await replyToLine(replyToken, 'คำถามนี้ไม่อยู่ในแผนของคุณ กำลังค้นหาข้อมูลเพิ่มเติม รอสักครู่นะครับ...')

  const enrichedAnswer = await answerWithEnrichedContext(text, itinerary, chatHistory)
  await pushToLine(lineId, enrichedAnswer)
  await saveChatHistory(lineId, text, enrichedAnswer)
}
