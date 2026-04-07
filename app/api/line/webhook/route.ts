import { NextRequest, NextResponse } from 'next/server'
import { validateSignature, webhook } from '@line/bot-sdk'
import { prisma } from '@/lib/db'
import { parseEvent } from '@/lib/line/parser'
import { replyToLine, pushToLine, replyFlexMessage } from '@/lib/line/client'
import { answerWithContext, answerWithEnrichedContext, saveChatHistory, formatItinerary, type ChatMessage } from '@/lib/line/injector'

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

  try {
    const result = await answerWithContext(text, itinerary, chatHistory, context.trip.shareCode)

    // LIFF view — send Flex Message with button to open itinerary in LINE
    if (result.liffView) {
      const liffId = process.env.LIFF_ID
      if (liffId) {
        const liffUrl = `https://liff.line.me/${liffId}?shareCode=${result.liffView.shareCode}`
        await replyFlexMessage(replyToken, `แผนการเดินทาง: ${result.liffView.title}`, {
          type: 'bubble',
          size: 'mega',
          body: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#000000',
            paddingAll: '18px',
            spacing: 'none',
            contents: [
              {
                type: 'text',
                text: `FULL ${result.liffView.totalDays} DAYS ITINERARY HERE`,
                color: '#B43325',
                size: 'xs',
                weight: 'bold',
              },
              {
                type: 'text',
                text: result.liffView.title,
                color: '#F8F7F4',
                size: 'xl',
                weight: 'bold',
                wrap: true,
                margin: 'sm',
              },
              {
                type: 'text',
                text: 'กดปุ่มด้านล่างเพื่อเปิดแผนการเดินทางแบบเต็ม',
                size: 'xs',
                color: '#F8F7F466',
                wrap: true,
                margin: 'lg',
              },
            ],
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#000000',
            paddingAll: '16px',
            paddingTop: 'none',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'ดูแผนเที่ยว',
                  uri: liffUrl,
                },
                style: 'primary',
                color: '#B43325',
                height: 'sm',
                margin: 'none',
              },
            ],
          },
          styles: {
            body: { backgroundColor: '#000000' },
            footer: { backgroundColor: '#000000' },
          },
        })
      } else {
        // Fallback if LIFF_ID not configured
        await replyToLine(replyToken, formatItinerary(itinerary as Parameters<typeof formatItinerary>[0]))
      }
      return
    }

    if (!result.needsFollowUp) {
      // Fast path — answer from itinerary was sufficient
      await replyToLine(replyToken, result.answer)
      await saveChatHistory(lineId, text, result.answer)
      return
    }

    // Slow path — tell user we're searching, then push enriched answer
    await replyToLine(replyToken, 'คำถามนี้ไม่อยู่ในแผนของคุณ กำลังค้นหาข้อมูลเพิ่มเติม รอสักครู่นะครับ...')

    try {
      const enrichedAnswer = await answerWithEnrichedContext(text, itinerary, chatHistory)
      await pushToLine(lineId, enrichedAnswer)
      await saveChatHistory(lineId, text, enrichedAnswer)
    } catch (err) {
      console.error('[webhook] Enriched answer failed:', err)
      await pushToLine(lineId, 'ขออภัยครับ ระบบค้นหาข้อมูลขัดข้อง กรุณาลองใหม่อีกครั้งนะครับ')
    }
  } catch (err) {
    console.error('[webhook] Answer failed:', err)
    await replyToLine(replyToken, 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งนะครับ')
  }
}
