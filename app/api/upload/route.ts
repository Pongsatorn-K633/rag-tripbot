import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { generateText, generateFromFile } from '@/lib/llm/client'
import { auth } from '@/lib/auth'
import { apiRateLimit, checkLimit, getClientIp } from '@/lib/rate-limit'

// ── Itinerary JSON contract shape ──────────────────────────────────────────
// Must match the project-wide contract defined in CLAUDE.md.
// { title, totalDays, season, days[{ day, location, activities, accommodation, transport }], shareCode }

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const ACCEPTED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

// JSON Schema fed to Gemini's structured-output mode. Gemini constrains
// generation to conform to this shape — no markdown fences, no missing
// fields, no wrong types, and `name` cannot exceed 60 characters.
const ITINERARY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    totalDays: { type: 'integer' },
    season: { type: 'string', enum: ['Winter', 'Spring', 'Summer', 'Autumn'] },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer' },
          location: { type: 'string' },
          activities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time: { type: 'string' },
                name: { type: 'string', maxLength: 60 },
                notes: { type: 'string' },
              },
              required: ['time', 'name'],
            },
          },
          accommodation: { type: 'string', nullable: true },
          transport: { type: 'string' },
        },
        required: ['day', 'location', 'activities'],
      },
    },
    shareCode: { type: 'string', nullable: true },
  },
  required: ['title', 'totalDays', 'season', 'days'],
} as const

const ACCEPTED_SHEET_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
])

const EXTRACTION_PROMPT = (extra: string) => `\
You are an itinerary extraction assistant for Japan travel planning.
Extract a structured Japan travel itinerary from the provided source.

Return ONLY valid JSON matching this exact structure — no explanation, no markdown fences:
{
  "title": "Trip title in English or Thai",
  "totalDays": <number>,
  "season": "Winter" | "Spring" | "Summer" | "Autumn",
  "days": [
    {
      "day": <number>,
      "location": "City name",
      "activities": [
        { "time": "HH:MM", "name": "Activity name", "notes": "Optional detail" }
      ],
      "accommodation": "Hotel or accommodation name",
      "transport": "How to travel this day"
    }
  ],
  "shareCode": null
}

Rules:
- "season" must be exactly one of: Winter, Spring, Summer, Autumn
- "totalDays" must equal the number of items in "days"
- "days" must be a sequential list: day 1, 2, 3, ... totalDays. NEVER repeat the same "day" number — merge all activities for the same calendar day into ONE day object. NEVER skip a day number.
- Every day must have at least one activity
- Preserve Thai text as-is when present
- If the source is unreadable, not a travel itinerary, or not related to trip planning, you MUST return EXACTLY this error JSON instead of making up an itinerary:
  {"error":"NOT_TRAVEL_RELATED","title":null,"totalDays":0,"season":null,"days":[]}
  Do NOT hallucinate or invent activities. Only extract what is actually in the source document.

FIELD DEFINITIONS — read carefully:
- "name": ONLY the proper noun of the place, landmark, station, restaurant, or activity name. Keep it SHORT (max ~6 words). It must be the *thing*, not a sentence describing the visit. Strip leading verbs like "Visit", "Go to", "Explore", "Mid-morning visit to", etc.
- "notes": all the descriptive detail — timing hints, photography tips, what to do there, why it's worth visiting. This is where long sentences belong. May be in Thai or English.
- "time": "HH:MM" 24-hour format only.
- "location": city or region (e.g. "Tokyo", "Nagano", "Kanagawa"), not a specific venue.
- "accommodation": hotel name only, or null if none for that day.
- "transport": short summary of how the traveler moves that day (e.g. "JR Yamanote Line + walk").

EXAMPLE — input source line:
"Day 2, Attraction. Mid-morning visit to Shimoyoshida Honcho Street. The 23mm lens is perfect here for framing the retro street signs with Mount Fuji looming in the background. Activity: ถ่ายรูปมุมถนน Shimoyoshida Honcho."

EXAMPLE — correct extraction:
{
  "time": "10:00",
  "name": "Shimoyoshida Honcho Street",
  "notes": "Mid-morning visit. 23mm lens is perfect for framing retro street signs with Mount Fuji in the background. ถ่ายรูปมุมถนน Shimoyoshida Honcho"
}

WRONG — do NOT do this:
{
  "name": "Mid-morning visit to Shimoyoshida Honcho Street. The 23mm lens is perfect..."
}

${extra}

Output JSON only:`

type FileKind = 'image' | 'pdf' | 'sheet' | 'unsupported'

function classify(file: File): FileKind {
  const name = file.name.toLowerCase()
  const type = file.type

  if (ACCEPTED_IMAGE_MIME.has(type) || /\.(png|jpe?g|webp)$/i.test(name)) return 'image'
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (ACCEPTED_SHEET_MIME.has(type) || /\.(xlsx|xls)$/i.test(name)) return 'sheet'
  return 'unsupported'
}

/**
 * Parse a spreadsheet buffer into a compact text representation suitable
 * for an LLM prompt. Each sheet is rendered as CSV with a header line.
 */
function spreadsheetToText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const chunks: string[] = []
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim().length === 0) continue
    chunks.push(`### Sheet: ${sheetName}\n${csv}`)
  }
  return chunks.join('\n\n').slice(0, 12000)
}

export async function POST(req: NextRequest) {
  // Member-only: VLM extraction is expensive (Gemini multimodal calls),
  // so we require a real session to prevent bot abuse and runaway bills.
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'กรุณาสมัครสมาชิกเพื่อใช้ฟีเจอร์ AI อ่านไฟล์ · Please sign up to use AI file extraction' },
      { status: 401 }
    )
  }

  // Rate limit per authenticated user — 30 uploads/min/user. Stops a
  // compromised account or rogue client from running up the Gemini bill.
  const rlKey = `upload:${session.user.id}`
  const { success, remaining, reset } = await checkLimit(apiRateLimit, rlKey)
  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return NextResponse.json(
      {
        error:
          'ใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง · ' +
          'Too many upload requests. Please wait a moment and try again.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
        },
      }
    )
  }

  let file: File | null = null

  try {
    const formData = await req.formData()
    file = formData.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 10 MB' }, { status: 413 })
  }

  const kind = classify(file)
  if (kind === 'unsupported') {
    return NextResponse.json(
      { error: 'รองรับเฉพาะไฟล์ PDF, รูปภาพ (PNG/JPG/WebP), หรือ Excel (.xlsx/.xls)' },
      { status: 415 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let raw: string
  let sheetText: string | null = null

  console.log(`[/api/upload] ${file.name} (${file.type || 'unknown'}) ${file.size}B → kind=${kind}`)

  try {
    if (kind === 'image') {
      // Gemini Flash handles image extraction natively (OCR + reasoning in one pass)
      const mimeType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
      raw = await generateFromFile(
        EXTRACTION_PROMPT('Source: an image of an itinerary. Read all visible text including Thai.'),
        buffer.toString('base64'),
        mimeType,
        { responseSchema: ITINERARY_SCHEMA },
      )
    } else if (kind === 'pdf') {
      // Gemini Flash accepts PDFs as inline data — no pre-OCR needed
      raw = await generateFromFile(
        EXTRACTION_PROMPT('Source: a PDF document of an itinerary. Read all pages.'),
        buffer.toString('base64'),
        'application/pdf',
        { responseSchema: ITINERARY_SCHEMA },
      )
    } else {
      // Spreadsheet: parse cells locally with SheetJS, then ask Gemini to normalize
      sheetText = spreadsheetToText(buffer)
      if (!sheetText.trim()) {
        return NextResponse.json({ error: 'ไฟล์ Excel ว่างเปล่า' }, { status: 400 })
      }
      console.log('[/api/upload] SheetJS extracted text:\n' + sheetText)
      raw = await generateText(
        EXTRACTION_PROMPT(`Source: a spreadsheet exported as CSV.\n\n${sheetText}`),
        { maxOutputTokens: 8192, disableThinking: true, responseSchema: ITINERARY_SCHEMA },
      )
    }
    console.log(`[/api/upload] Gemini raw output (${raw?.length ?? 0} chars):\n` + raw)
  } catch (err) {
    console.error('[/api/upload] LLM call error:', err)
    return NextResponse.json(
      { error: 'Failed to process file. Check that GEMINI_API_KEY is configured.' },
      { status: 500 },
    )
  }

  const debug = {
    kind,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    sheetText,
    geminiRaw: raw,
  }

  try {
    const clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    if (!clean) {
      throw new Error('Gemini returned an empty response (possibly hit token limit or safety filter)')
    }

    const itinerary = JSON.parse(clean)

    // Gemini signals "not a travel document" via the error field or empty days.
    if (
      itinerary.error === 'NOT_TRAVEL_RELATED' ||
      !itinerary.days ||
      !Array.isArray(itinerary.days) ||
      itinerary.days.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'ไฟล์ที่อัปโหลดไม่ใช่แผนการเดินทาง กรุณาตรวจสอบไฟล์อีกครั้ง · ' +
            'The uploaded file does not appear to be a travel itinerary. Please check your file and try again.',
          debug,
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ itinerary, debug })
  } catch (err) {
    console.error('[/api/upload] JSON parse error:', err)
    const message = err instanceof Error ? err.message : 'parse failed'
    return NextResponse.json(
      {
        error: `แปลงข้อมูลไม่สำเร็จ: ${message}`,
        debug,
      },
      { status: 500 },
    )
  }
}
