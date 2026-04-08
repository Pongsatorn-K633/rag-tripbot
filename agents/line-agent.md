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
    trips/
      by-code/route.ts    ← GET /api/trips/by-code?shareCode=XXX (returns trip itinerary JSON for LIFF)
  liff/
    itinerary/page.tsx    ← LIFF page — fetches trip by shareCode, renders day-by-day accordion (dark theme)
lib/
  line/
    client.ts             ← LINE SDK wrapper (replyToLine, pushToLine, replyFlexMessage)
    parser.ts             ← Parse incoming webhook events (incl. @-mention detection)
    trigger.ts            ← Group-chat trigger word gate (doma / โดมะ / @dopamichi)
    injector.ts           ← Build context-injected prompt from Trip JSON + hybrid intent classification
```

**Do NOT touch:** `app/page.tsx`, `app/chat/`, `lib/rag/`, `lib/db/schema.prisma`,
`prisma/`, `app/api/chat/`, `app/api/activate/`

---

## Prerequisites

Before starting, verify with the orchestrator that Phase 2 is complete:
- `LineContext` table exists in Neon (DB Agent's work)
- `lib/db/index.ts` exports `prisma` (DB Agent's work)
- `lib/llm/client.ts` exports `generateText` (RAG Agent's work)

---

## Environment Setup

Add to `.env`:
```env
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_BOT_USER_ID=your_bot_user_id   # Basic settings → "Your user ID" — used for @-mention detection in groups
LIFF_ID=your_liff_id
```

## Group-Chat Trigger Word Gate (2026-04-08)

To avoid forcing users into a dedicated bot-only group, the webhook requires a
**trigger word** before it will respond to any message in a `group` source.

**Triggers (case-insensitive):**
- `doma ...` — English prefix
- `โดมะ ...` — Thai prefix
- `@dopamichi ...` / `@doma ...` / `@โดมะ ...` — literal @-mention text
- A real LINE @-mention of the bot (detected via `mention.mentionees` matching `LINE_BOT_USER_ID`)

**Rules:**
- Without a trigger, the bot **silently ignores** the message (no reply, no hint)
- `/activate` always works, trigger or not — users must be able to bind a group
- `@all` is **not** a trigger
- DMs (`user` source) don't need a trigger
- On `join` event (bot added to group), send a bilingual welcome explaining the rule

Implementation: `lib/line/trigger.ts` → `checkTrigger(text, mentionedBot)` returns `{ triggered, cleanText }`. The cleanText (trigger prefix stripped) is what gets passed to the RAG pipeline.

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
import { Client, Message, FlexMessage } from '@line/bot-sdk'

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

// Send a Flex Message with a button that opens a LIFF page
export async function replyFlexMessage(
  replyToken: string,
  flexContent: FlexMessage
): Promise<void> {
  await lineClient.replyMessage(replyToken, flexContent)
}
```

The `replyFlexMessage()` function is used when the user requests to view the full plan. The webhook handler builds a Flex Message with a "ดูแผนเต็ม" button that opens the LIFF itinerary page.

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

This is the core of the LINE bot — it takes the stored itinerary JSON and answers
questions using a two-pass strategy with **hybrid intent classification**:

### Hybrid Intent Classification (`isFullPlanRequest`)

Uses a two-layer approach to detect "show full plan" requests:

1. **Regex fast gate** — catches clean requests like "ขอดูแผน", "plan please", "itinerary" with 0 API calls.
2. **LLM fallback** — if regex does not match, the Gemini prompt includes intent classification as Step 1. If Gemini detects a "show plan" intent (even with typos like "plna pls"), it returns `[SHOW_PLAN]` token. Otherwise it proceeds to answer the question normally in Step 2. This is done in the SAME Gemini call — no extra API cost.

The prompt structure:
- **Step 1: จำแนกความต้องการ** — classify if user wants to VIEW the full plan -> `[SHOW_PLAN]`
- **Step 2: ตอบคำถาม** — answer the question from itinerary

Note: "สรุปทริป" (trip summary) goes to Step 2 (Gemini answers), NOT treated as a full plan view request.

### Answer Strategies

1. **Full plan request detected** (`answerWithContext` returns `liffView` object): The webhook handler sends a Flex Message with a "ดูแผนเต็ม" button that opens the LIFF itinerary page — no text dump of the full itinerary.
2. **Fast path** (`answerWithContext`): Answers from the itinerary JSON only using `generateText()`. Returns `needsFollowUp: true` if the answer contains fallback phrases (e.g., "ไม่มีข้อมูลในแผน").
3. **Enriched path** (`answerWithEnrichedContext`): A single Gemini 2.5 Flash call via `generateWithSearch()` from `lib/rag/web-search.ts` — uses Google Search grounding with the persona prompt built in. No separate web search step needed.

```typescript
import { generateText } from '../llm/client'
import { generateWithSearch } from '../rag/web-search'

// Returns liffView when user wants full plan, otherwise answers normally
export async function answerWithContext(
  userQuestion: string,
  itineraryJson: object,
  chatHistory: ChatMessage[] = []
): Promise<AnswerResult> {
  // Step 1: Regex fast gate for full plan requests
  // Step 2: If no regex match, LLM prompt includes intent classification
  //         — returns { liffView: { shareCode } } if [SHOW_PLAN] detected
  //         — returns { answer, needsFollowUp } otherwise
}

// Enriched path — single Gemini call with Google Search grounding
export async function answerWithEnrichedContext(
  userQuestion: string,
  itineraryJson: object,
  chatHistory: ChatMessage[] = []
): Promise<string> {
  const prompt = buildEnrichedPrompt(userQuestion, itineraryJson, chatHistory)
  const answer = await generateWithSearch(prompt)  // one API call
  return answer.trim()
}
```

`buildEnrichedPrompt()` includes the persona and instructs Gemini to search Google directly — no `extraContext` parameter needed.

---

## Webhook Handler (`app/api/line/webhook/route.ts`)

This is the main entry point for all LINE messages.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { middleware, WebhookEvent } from '@line/bot-sdk'
import { prisma } from '@/lib/db'
import { parseEvent } from '@/lib/line/parser'
import { replyToLine, pushToLine, replyFlexMessage } from '@/lib/line/client'
import { answerWithContext, answerWithEnrichedContext } from '@/lib/line/injector'

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
      'ยังไม่ได้เปิดใช้งานแผนการเดินทาง กรุณาพิมพ์ /activate [รหัส] ก่อนนะครับ'
    )
    return
  }

  const result = await answerWithContext(text, context.trip.itinerary as object)

  // LIFF view path — user wants to see the full plan
  if (result.liffView) {
    const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}?shareCode=${result.liffView.shareCode}`
    await replyFlexMessage(replyToken, {
      type: 'flex',
      altText: 'ดูแผนเต็ม',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: context.trip.title, weight: 'bold', size: 'lg' },
            { type: 'text', text: 'กดปุ่มเพื่อดูแผนเต็มแบบสวยงาม', size: 'sm', color: '#888888', margin: 'md' },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              action: { type: 'uri', label: 'ดูแผนเต็ม', uri: liffUrl },
            },
          ],
        },
      },
    })
    return
  }

  // Two-pass: fast answer from itinerary, then enriched if needed
  const { answer, needsFollowUp } = result
  await replyToLine(replyToken, answer!)

  // If fast answer was insufficient, send enriched answer as follow-up
  if (needsFollowUp) {
    const enriched = await answerWithEnrichedContext(text, context.trip.itinerary as object)
    await pushToLine(context.lineId, enriched)
  }
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
4. `ขอดูแผน` → should send a Flex Message with "ดูแผนเต็ม" button (opens LIFF page)
5. `plna pls` → should also trigger LIFF view (LLM fallback catches typos)
6. `สรุปทริป` → should NOT open LIFF — Gemini answers with a summary instead

---

## Verification Checklist

- [ ] Webhook signature validation works (returns 403 for invalid sig)
- [ ] `/activate TKY-492` links LINE ID to correct trip in `LineContext` table
- [ ] `/activate` with wrong code returns Thai error message
- [ ] Regular question returns answer scoped to itinerary
- [ ] Out-of-scope question returns graceful Thai fallback
- [ ] Both DM (user source) and group chat (group source) work
- [ ] LINE Developers Console shows 200 responses in webhook log
- [ ] "ขอดูแผน" sends Flex Message with LIFF button (regex fast gate)
- [ ] Typos like "plna pls" also trigger LIFF view (LLM fallback)
- [ ] "สรุปทริป" is answered by Gemini, NOT treated as full plan view
- [ ] LIFF page at `/liff/itinerary` loads and renders the itinerary in dark-themed accordion UI
- [ ] `GET /api/trips/by-code?shareCode=XXX` returns trip itinerary JSON
- [ ] `LIFF_ID` is set in `.env`

---

## Rules

- All user-facing strings must be in Thai
- Never store the LINE channel secret in code — only in `.env`
- Always validate the LINE signature before processing any event
- Import `prisma` from `@/lib/db` — never create a new PrismaClient
- Import `generateText` from `@/lib/llm/client` for itinerary-only answers
- Import `generateWithSearch` from `@/lib/rag/web-search` for enriched answers (single Gemini call with Google Search grounding)
- Keep LLM responses under 300 characters for LINE readability — add instruction in prompt
- Do not modify `lib/rag/` — the LINE bot uses context injection only, not RAG retrieval
