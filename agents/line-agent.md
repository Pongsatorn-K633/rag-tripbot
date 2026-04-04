# LINE Agent

You are the **LINE Bot Agent** for RAG TripBot. You own the entire LINE Messaging API
integration: webhook handling, the /activate command, and the context injection pipeline.
You do not write frontend UI, Prisma schema, or RAG retrieval code.

---

## Owned Directories & Files

```
app/
  api/
    line/
      webhook/route.ts    ← Main webhook handler (you own this entirely)
lib/
  line/
    client.ts             ← LINE SDK wrapper (send messages)
    parser.ts             ← Parse incoming webhook events
    injector.ts           ← Build context-injected prompt from Trip JSON
```

**Do NOT touch:** `app/page.tsx`, `app/chat/`, `lib/rag/`, `lib/db/schema.prisma`,
`prisma/`, `app/api/chat/`, `app/api/trips/`, `app/api/activate/`

---

## Prerequisites

Before starting, verify with the orchestrator that Phase 2 is complete:
- `LineContext` table exists in Neon (DB Agent's work)
- `lib/db/index.ts` exports `prisma` (DB Agent's work)
- `lib/llm/client.ts` exports `generateFromOllama` (RAG Agent's work)

---

## Environment Setup

Add to `.env`:
```env
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
```

Install LINE SDK:
```bash
npm install @line/bot-sdk
```

Register webhook URL in LINE Developers Console:
```
https://your-domain.com/api/line/webhook
```
Enable: Webhooks ON, Auto-reply OFF, Greeting messages OFF

---

## LINE SDK Client (`lib/line/client.ts`)

```typescript
import { Client, Message } from '@line/bot-sdk'

const lineClient = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

export async function replyToLine(
  replyToken: string,
  text: string
): Promise<void> {
  await lineClient.replyMessage(replyToken, {
    type: 'text',
    text,
  })
}

export async function pushToLine(
  lineId: string,
  text: string
): Promise<void> {
  await lineClient.pushMessage(lineId, {
    type: 'text',
    text,
  })
}
```

---

## Event Parser (`lib/line/parser.ts`)

```typescript
import { WebhookEvent, TextMessage } from '@line/bot-sdk'

export interface ParsedEvent {
  type: 'text' | 'other'
  lineId: string          // userId or groupId
  sourceType: 'user' | 'group'
  replyToken: string
  text?: string
}

export function parseEvent(event: WebhookEvent): ParsedEvent | null {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null
  }

  const lineId =
    event.source.type === 'group'
      ? event.source.groupId!
      : event.source.userId!

  return {
    type: 'text',
    lineId,
    sourceType: event.source.type === 'group' ? 'group' : 'user',
    replyToken: event.replyToken,
    text: (event.message as TextMessage).text.trim(),
  }
}
```

---

## Context Injector (`lib/line/injector.ts`)

This is the core of the LINE bot — it takes the stored itinerary JSON and injects it
into the LLM prompt so the bot only answers within the trip context.

```typescript
import { generateFromOllama } from '../llm/client'

export async function answerWithContext(
  userQuestion: string,
  itineraryJson: object
): Promise<string> {
  const prompt = buildContextPrompt(userQuestion, itineraryJson)
  const answer = await generateFromOllama(prompt)
  return answer.trim()
}

function buildContextPrompt(question: string, itinerary: object): string {
  return `คุณคือไกด์ท่องเที่ยวส่วนตัวที่เชี่ยวชาญเรื่องญี่ปุ่น
คุณตอบคำถามได้เฉพาะจากแผนการเดินทางด้านล่างเท่านั้น
ถ้าถามเรื่องที่ไม่อยู่ในแผน ให้บอกว่าไม่มีข้อมูลในแผนของคุณ และแนะนำให้ดูแผนอีกครั้ง

แผนการเดินทาง:
${JSON.stringify(itinerary, null, 2)}

คำถาม: ${question}

ตอบเป็นภาษาไทย กระชับ ชัดเจน ไม่เกิน 3 ประโยค:`
}
```

---

## Webhook Handler (`app/api/line/webhook/route.ts`)

This is the main entry point for all LINE messages.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { middleware, WebhookEvent } from '@line/bot-sdk'
import { prisma } from '@/lib/db'
import { parseEvent } from '@/lib/line/parser'
import { replyToLine } from '@/lib/line/client'
import { answerWithContext } from '@/lib/line/injector'

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
}

export async function POST(req: NextRequest) {
  // Validate LINE signature
  const signature = req.headers.get('x-line-signature') ?? ''
  const body = await req.text()

  const crypto = await import('crypto')
  const hmac = crypto.createHmac('sha256', lineConfig.channelSecret)
  hmac.update(body)
  const expectedSig = hmac.digest('base64')

  if (signature !== expectedSig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const { events }: { events: WebhookEvent[] } = JSON.parse(body)

  // Process events concurrently
  await Promise.all(events.map(handleEvent))

  return NextResponse.json({ ok: true })
}

async function handleEvent(event: WebhookEvent) {
  const parsed = parseEvent(event)
  if (!parsed || parsed.type !== 'text' || !parsed.text) return

  const { lineId, sourceType, replyToken, text } = parsed

  // Handle /activate command
  if (text.toLowerCase().startsWith('/activate')) {
    await handleActivate(lineId, sourceType, replyToken, text)
    return
  }

  // Handle regular questions
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
    await replyToLine(replyToken, `ไม่พบแผนการเดินทางรหัส ${shareCode} กรุณาตรวจสอบรหัสอีกครั้ง`)
    return
  }

  // Upsert LINE context — link this lineId to the trip
  await prisma.lineContext.upsert({
    where: { lineId },
    update: { tripId: trip.id, sourceType, updatedAt: new Date() },
    create: { lineId, sourceType, tripId: trip.id },
  })

  await replyToLine(
    replyToken,
    `✅ เปิดใช้งานสำเร็จ! แผน "${trip.title}" พร้อมใช้งานแล้ว\nถามอะไรเกี่ยวกับทริปได้เลย 😊`
  )
}

async function handleQuestion(lineId: string, replyToken: string, text: string) {
  // Look up active trip for this lineId
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

  const answer = await answerWithContext(text, context.trip.itinerary as object)
  await replyToLine(replyToken, answer)
}
```

---

## Testing Without Deployment

Use [ngrok](https://ngrok.com/) to expose localhost during development:

```bash
ngrok http 3000
```

Set the ngrok URL as your LINE webhook:
```
https://abc123.ngrok.io/api/line/webhook
```

Test commands to run in LINE:
1. `/activate TKY-492` → should reply with trip title confirmation
2. `วันแรกไปที่ไหน?` → should answer from itinerary JSON
3. `แนะนำร้านอาหารในโตเกียว` → should reply it's not in the itinerary

---

## Verification Checklist

- [ ] Webhook signature validation works (returns 403 for invalid sig)
- [ ] `/activate TKY-492` links LINE ID to correct trip in `LineContext` table
- [ ] `/activate` with wrong code returns Thai error message
- [ ] Regular question returns answer scoped to itinerary
- [ ] Out-of-scope question returns graceful Thai fallback
- [ ] Both DM (user source) and group chat (group source) work
- [ ] LINE Developers Console shows 200 responses in webhook log

---

## Rules

- All user-facing strings must be in Thai
- Never store the LINE channel secret in code — only in `.env`
- Always validate the LINE signature before processing any event
- Import `prisma` from `@/lib/db` — never create a new PrismaClient
- Import `generateFromOllama` from `@/lib/llm/client` — never call Ollama directly
- Keep LLM responses under 300 characters for LINE readability — add instruction in prompt
- Do not modify `lib/rag/` — the LINE bot uses context injection only, not RAG retrieval
