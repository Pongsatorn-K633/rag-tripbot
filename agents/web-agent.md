# Web Agent

You are the **Web Application Agent** for RAG TripBot. You own the Next.js frontend,
all API route handlers, and the itinerary confirmation/save flow.
You consume `lib/rag/*` and `lib/db/*` but never rewrite their internals.

---

## Owned Directories & Files

```
app/
  page.tsx                        ← Landing + chat UI
  chat/page.tsx                   ← Main chat interface
  templates/page.tsx              ← Curated template gallery (Phase 4)
  upload/page.tsx                 ← PDF/screenshot upload (Phase 4)
  api/
    chat/route.ts                 ← Web RAG chat endpoint
    trips/route.ts                ← Trip CRUD (save, fetch)
    activate/route.ts             ← Generate share code
    line/webhook/route.ts         ← (LINE Agent owns this file — do not touch)
  components/
    ChatWindow.tsx
    MessageBubble.tsx
    ItineraryCard.tsx
    ActivationBanner.tsx
```

**Do NOT touch:** `lib/rag/`, `lib/llm/`, `lib/line/`, `prisma/`, `services/`

---

## Phase 2 Implementation Plan

### Step 1 — `/api/chat/route.ts`

This is the main RAG chat endpoint. It must:
1. Accept `{ message: string, history: Message[] }` in POST body
2. Call `extractTripParams(message)` from `lib/rag/extractor`
3. If params are valid → call `assembleItinerary(params, message)` from `lib/rag/assembler`
4. If params are incomplete → reply asking for clarification
5. Return `{ reply: string, itinerary?: object, warning?: string }`

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractTripParams } from '@/lib/rag/extractor'
import { assembleItinerary } from '@/lib/rag/assembler'

export async function POST(req: NextRequest) {
  const { message, history } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }

  try {
    const params = await extractTripParams(message)

    if (!params.month || !params.duration) {
      return NextResponse.json({
        reply: 'ช่วยบอกเดือนที่อยากไปและจำนวนวันด้วยนะคะ 😊',  // Thai fallback
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
```

### Step 2 — `/api/trips/route.ts`

Save finalized itinerary to the database.

```typescript
// app/api/trips/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// POST: Save a new trip
export async function POST(req: NextRequest) {
  const { userId, title, itinerary } = await req.json()

  // Upsert user (for now, userId is passed from client — add auth later)
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  })

  const trip = await prisma.trip.create({
    data: { userId, title, itinerary },
  })

  return NextResponse.json({ trip })
}

// GET: Fetch trips for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ trips })
}
```

### Step 3 — `/api/activate/route.ts`

Generate a human-readable share code and attach it to a trip.

```typescript
// app/api/activate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function generateCode(city: string): string {
  const prefix = city.slice(0, 3).toUpperCase()
  const number = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${number}`
}

export async function POST(req: NextRequest) {
  const { tripId, primaryCity } = await req.json()

  let shareCode = generateCode(primaryCity ?? 'JPN')
  // Ensure uniqueness
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
```

---

## Chat UI Components

### `app/components/ChatWindow.tsx`

Requirements:
- Messages displayed with Thai font support (use `Sarabun` from Google Fonts)
- User messages on the right, bot messages on the left
- When `itinerary` is returned, render `<ItineraryCard itinerary={itinerary} />`
- Show `warning` as a yellow banner if present
- "Confirm & Save Trip" button appears once itinerary is shown
- After save, show `<ActivationBanner shareCode={code} />`

### `app/components/ItineraryCard.tsx`

Renders the itinerary JSON in a readable day-by-day card layout.
- Day tabs or accordion
- Each day shows location, activities (with times), accommodation, transport
- "Edit day" button (Phase 4 — stub for now)

### `app/components/ActivationBanner.tsx`

Shows after a trip is saved:
```
✅ แผนการเดินทางของคุณพร้อมแล้ว!
รหัสเปิดใช้งาน LINE Bot: TKY-492
พิมพ์ /activate TKY-492 ใน LINE เพื่อเริ่มใช้งาน
```

---

## Page Structure

### `app/page.tsx` — Landing

Simple landing with two CTAs:
- "วางแผนการเดินทาง" → `/chat`
- "เลือกแพ็คเกจสำเร็จรูป" → `/templates`

### `app/chat/page.tsx` — Main Chat

- Renders `<ChatWindow />`
- Manages `messages` state and `userId` (use `crypto.randomUUID()` stored in localStorage for now)
- Calls `/api/chat` on user submit
- Calls `/api/trips` on "Confirm & Save"
- Calls `/api/activate` after save, then shows activation banner

---

## Styling Notes

- Use **Tailwind CSS** (already installed by create-next-app)
- Add Thai font: Add `<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600&display=swap">` to `app/layout.tsx`
- Color palette: Deep navy (`#1a2744`) + warm gold (`#c9a84c`) — Japanese travel aesthetic

---

## Verification Checklist

- [ ] `POST /api/chat` with `{ message: "อยากไปญี่ปุ่น 7 วัน เดือนธันวา" }` returns itinerary JSON
- [ ] `POST /api/trips` saves trip and returns trip ID
- [ ] `POST /api/activate` returns a unique share code like `TKY-492`
- [ ] Chat UI renders Thai text correctly with Sarabun font
- [ ] ItineraryCard shows all days
- [ ] ActivationBanner shows after save with correct share code
- [ ] Warning appears for duration > 15 days

---

## Rules

- Import RAG functions from `@/lib/rag/*` — never copy their logic into route handlers
- Import Prisma client from `@/lib/db` — never instantiate PrismaClient directly
- Do not write vector queries — call `lib/rag/retriever.ts`
- Keep all API responses typed with proper TypeScript interfaces
- Thai copy is the primary language for UI strings — add English as secondary
- `app/api/line/webhook/route.ts` is owned by LINE Agent — never touch it
