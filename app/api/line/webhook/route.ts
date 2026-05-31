import { NextRequest, NextResponse } from 'next/server'
import { validateSignature, webhook } from '@line/bot-sdk'
import { prisma } from '@/lib/db'
import { parseEvent } from '@/lib/line/parser'
import { checkTrigger } from '@/lib/line/trigger'
import { replyToLine, pushToLine, replyFlexMessage } from '@/lib/line/client'
import { answerWithContext, answerWithEnrichedContext, saveChatHistory, formatItinerary, type ChatMessage } from '@/lib/line/injector'
import { activateRateLimit, checkLimit } from '@/lib/rate-limit'

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
  // First time a user adds the bot as a friend — greet them with a button that
  // opens the "แพลนพร้อมเที่ยว" (pre-planned trips) LIFF browser.
  if (event.type === 'follow') {
    const replyToken = (event as webhook.FollowEvent).replyToken
    if (replyToken) await sendFollowWelcome(replyToken)
    return
  }

  // Send a welcome message whenever the bot is added to a group or room.
  if (event.type === 'join') {
    const replyToken = (event as webhook.JoinEvent).replyToken
    if (replyToken) await replyToLine(replyToken, GROUP_WELCOME_MESSAGE)
    return
  }

  // Bot removed from a group/room, or blocked in a DM → free that chat's binding
  // so the trip's share code becomes available to activate elsewhere again.
  if (event.type === 'leave' || event.type === 'unfollow') {
    await releaseBinding(event)
    return
  }

  const parsedEvent = parseEvent(event)
  if (!parsedEvent || parsedEvent.type !== 'text' || !parsedEvent.text) return

  const { lineId, sourceType, replyToken, text, mentionedBot } = parsedEvent

  // /activate always works — users must be able to bind a group even before
  // learning about the trigger word.
  if (text.toLowerCase().startsWith('/activate')) {
    await handleActivate(lineId, sourceType, replyToken, text)
    return
  }

  // /deactivate releases this chat's binding so the code can be used elsewhere.
  if (text.toLowerCase().startsWith('/deactivate')) {
    await handleDeactivate(lineId, replyToken, text)
    return
  }

  // Group chats require a trigger word (doma / โดมะ / @dopamichi mention).
  // Without it we stay silent — no error, no hint — so the bot doesn't spam
  // regular group conversation.
  let questionText = text
  if (sourceType === 'group') {
    const { triggered, cleanText } = checkTrigger(text, mentionedBot ?? false)
    if (!triggered) return
    // If the user typed ONLY the trigger word with no question (e.g. just
    // "doma" or "โดมะ"), reply with a friendly greeting instead of sending
    // an empty string to Gemini (which would trigger the enrichment path).
    if (!cleanText) {
      await replyToLine(
        replyToken,
        'ว่าไงครับ! 👋 ถามคำถามเกี่ยวกับทริปได้เลยนะครับ\nตัวอย่าง: doma พรุ่งนี้ต้องไปถึงสนามบินกี่โมง'
      )
      return
    }
    questionText = cleanText
  }

  await handleQuestion(lineId, replyToken, questionText)
}

/**
 * Add-friend welcome — a branded (website light palette) Flex card with a button
 * that opens the pre-planned trips LIFF browser. The URL is configurable via
 * LIFF_PREPLANNED_URL (a liff.line.me/<ID> URL for a dedicated LIFF app);
 * otherwise it falls back to the production web LIFF page.
 */
async function sendFollowWelcome(replyToken: string) {
  const prePlannedUrl =
    process.env.LIFF_PREPLANNED_URL ?? 'https://dopamichi.com/liff/pre-planned'

  await replyFlexMessage(replyToken, 'ยินดีต้อนรับสู่ Dopamichi · ดูแพลนพร้อมเที่ยว', {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F8F7F4',
      paddingAll: '20px',
      spacing: 'none',
      contents: [
        { type: 'text', text: 'Dopamichi • Pre-planned trip 🎒⛩️', color: '#B43325', size: 'xs', weight: 'bold' }
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F8F7F4',
      paddingAll: '16px',
      paddingTop: 'none',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: 'ดูแพลนพร้อมเที่ยว', uri: prePlannedUrl },
          style: 'primary',
          color: '#B43325',
          height: 'sm',
        },
      ],
    },
    styles: {
      body: { backgroundColor: '#F8F7F4' },
      footer: { backgroundColor: '#F8F7F4' },
    },
  })
}

const GROUP_WELCOME_MESSAGE =
  'โยโคโสะ! ผม Dopamichi ไกด์ญี่ปุ่นส่วนตัวของกลุ่มนี้ครับ 🎒✨\n\n' +
  '📌 เมื่อระบบซิงค์ข้อมูลเรียบร้อยแล้ว: พิมพ์ /activate [รหัสทริป] เพื่อเปิดแผนการเดินทางของคุณ\n' +
  `💬 เพื่อให้ทุกคนแพลนทริปกันได้ลื่นไหลไม่ขัดจังหวะแชท ถ้ามีคำถามถึงผม แค่พิมพ์ "doma" หรือ "โดมะ" นำหน้าประโยคได้เลยคร้าบ 🙌🏻\n\n` +
  `💡 ตัวอย่าง: doma พรุ่งนี้ต้องไปถึงสนามบินกี่โมง`

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

  // Throttle per LINE user so the short code space can't be brute-forced by
  // spraying `/activate` guesses at the bot.
  const { success } = await checkLimit(activateRateLimit, lineId)
  if (!success) {
    await replyToLine(
      replyToken,
      'มีการลองเปิดใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้งนะครับ 🙏'
    )
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

  // Exclusive claim: a trip holds at most ONE group binding + ONE DM binding.
  // If the matching slot (same sourceType) is already held by a DIFFERENT chat,
  // refuse — the code is in use elsewhere right now. (Freed via /deactivate, the
  // bot leaving the group, or the trip being deleted.)
  const slotHolder = await prisma.lineContext.findFirst({
    where: { tripId: trip.id, sourceType, NOT: { lineId } },
  })
  if (slotHolder) {
    await replyToLine(
      replyToken,
      'รหัสทริปนี้ถูกใช้งานโดยกลุ่มหรือบุคคลอื่นอยู่ ณ ขณะนี้ กรุณาตรวจสอบรหัสอีกครั้งครับ\n\n' +
        `หากต้องการเปลี่ยนกลุ่มให้แชทบอท พิมพ์ /deactivate ${shareCode} ในกลุ่มเก่าครับ`
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
    `แผนเที่ยวพร้อมแล้ว! "${trip.title}" ⛩️🎉 ผมพร้อมตอบทุกข้อสงสัยในรูทนี้ พิมพ์คำถามของคุณมาได้เลย!\n\n` +
      `💡 แผนนี้มีตัวเลือกร้านอาหารให้เลือก ถามผมได้เลยครับ เช่น\n` +
      `• "doma ร้านอาหารเย็นมีอะไรบ้าง"\n\n` +
      `ในกลุ่ม พิมพ์ "doma" หรือ "โดมะ" นำหน้าคำถามนะครับ 🙌🏻`
  )
}

/**
 * /deactivate — release the binding in the current chat so the trip's share code
 * can be activated in another group or DM. (Each trip holds at most one group +
 * one DM binding; this frees the matching slot.)
 */
async function handleDeactivate(lineId: string, replyToken: string, text: string) {
  const code = text.split(' ')[1]?.toUpperCase() // optional confirmation code
  const ctx = await prisma.lineContext.findUnique({ where: { lineId }, include: { trip: true } })
  if (!ctx) {
    await replyToLine(
      replyToken,
      'แชทนี้ยังไม่ได้เปิดใช้งานแผนการเดินทาง พิมพ์ /activate [รหัส] เพื่อเริ่มใช้งานครับ'
    )
    return
  }
  // If a code is supplied it must match the plan active here — guards against
  // releasing the wrong trip.
  if (code && ctx.trip.shareCode && code !== ctx.trip.shareCode) {
    await replyToLine(
      replyToken,
      `รหัส ${code} ไม่ตรงกับแผนที่เปิดใช้งานอยู่ในแชทนี้ (กำลังใช้: ${ctx.trip.shareCode}) ครับ`
    )
    return
  }
  const label = ctx.trip.shareCode ? `${ctx.trip.shareCode} · "${ctx.trip.title}"` : `"${ctx.trip.title}"`
  await prisma.lineContext.delete({ where: { lineId } })
  await replyToLine(
    replyToken,
    `ยกเลิกการใช้งานแผน ${label} ในแชทนี้แล้ว ✅\nรหัสนี้พร้อมเปิดใช้งานที่กลุ่มหรือแชทอื่นได้แล้วครับ`
  )
}

/**
 * Auto-release a binding when the bot is removed from a group/room (`leave`) or
 * blocked by a user (`unfollow`). The bound `lineId` is the group/room/user id;
 * deleteMany is a safe no-op if that chat had no active binding.
 */
async function releaseBinding(event: webhook.Event) {
  const source = (event as { source?: { groupId?: string; roomId?: string; userId?: string } }).source
  const lineId = source?.groupId ?? source?.roomId ?? source?.userId
  if (!lineId) return
  await prisma.lineContext.deleteMany({ where: { lineId } })
}

async function handleQuestion(lineId: string, replyToken: string, text: string) {
  const context = await prisma.lineContext.findUnique({
    where: { lineId },
    include: { trip: true },
  })

  if (!context) {
    await replyToLine(
      replyToken,
      'ยังไม่ได้เปิดใช้งานแผนการเดินทาง กรุณาพิมพ์ /activate [รหัส] ก่อนนะครับ'
    )
    return
  }

  const itinerary = context.trip.itinerary as object
  const chatHistory = (context.chatHistory as ChatMessage[] | null) ?? []

  try {
    const result = await answerWithContext(text, itinerary, chatHistory, context.trip.shareCode, context.trip.startDate)

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
