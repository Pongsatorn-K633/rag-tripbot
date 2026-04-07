import { generateText } from '../llm/client'
import { generateWithSearch } from '../rag/web-search'
import { prisma } from '../db'

interface Itinerary {
  title?: string
  totalDays?: number
  season?: string
  days?: {
    day: number
    location: string
    activities: { time: string; name: string; notes?: string }[]
    accommodation: string
    transport: string
  }[]
}

// Phrases that indicate the LLM couldn't answer from the itinerary alone
const FALLBACK_PHRASES = [
  'ไม่มีข้อมูล', 'ไม่มีในแผน', 'ไม่ได้ระบุ', 'ไม่ปรากฏ',
  'ไม่อยู่ในแผน', 'ไม่มีรายละเอียด', 'ไม่ทราบ',
]

function needsEnrichment(answer: string): boolean {
  const lower = answer.toLowerCase()
  return FALLBACK_PHRASES.some((phrase) => lower.includes(phrase))
}

const FULL_PLAN_PATTERNS = [
  // Thai — clear "show me the plan" intent
  /ขอ(ดู)?(แผน|แพลน)/, /(แผน|แพลน)ทั้งหมด/, /ดู(แผน|แพลน)ทั้งหมด/,
  /ขอ(แผน|แพลน)(ท่องเที่ยว|เที่ยว)/, /ขอดูทริป/, /ขอดูทั้งหมด/,
  /(แผน|แพลน)การเดินทาง(ทั้งหมด)?$/, /แผนทั้งหมด/, /ดูทริป/,
  // English — clear "show me the plan" intent, not "I plan to..."
  /^plan(\s*(pls|please|plz|thx|thanks))?\s*[?!.]?\s*$/i,
  /(show|see|view|need|get|give|open)\s*(me\s*)?(the\s*)?(full\s*)?plan/i,
  /^(my|the|full)\s*plan\s*[?!.]?\s*$/i,
  /\bitinerary\b/i,
]

function isFullPlanRequest(message: string): boolean {
  const trimmed = message.trim()
  return FULL_PLAN_PATTERNS.some((p) => p.test(trimmed))
}

export function formatItinerary(itinerary: Itinerary): string {
  const lines: string[] = []
  lines.push(itinerary.title ?? 'แผนการเดินทาง')
  lines.push(`${itinerary.totalDays ?? '?'} วัน | ${itinerary.season ?? ''}`)
  lines.push('')

  for (const day of itinerary.days ?? []) {
    lines.push(`วันที่ ${day.day}: ${day.location}`)
    for (const act of day.activities) {
      lines.push(`  ${act.time} ${act.name}${act.notes ? ` (${act.notes})` : ''}`)
    }
    lines.push(`  ที่พัก: ${day.accommodation}`)
    lines.push(`  เดินทาง: ${day.transport}`)
    lines.push('')
  }

  return lines.join('\n').trim()
}


export interface ChatMessage {
  role: 'user' | 'bot'
  content: string
}

const MAX_HISTORY = 10  // keep last 10 messages (5 pairs)

export interface AnswerResult {
  answer: string
  needsFollowUp: boolean  // true = fast answer was insufficient, enriched answer coming
  liffView?: {            // set when user asks for full plan — sends Flex Message with LIFF link
    title: string
    totalDays: number
    season: string
    shareCode: string
  }
}

// Quick first pass — answers from itinerary only
export async function answerWithContext(
  userQuestion: string,
  itineraryJson: object,
  chatHistory: ChatMessage[] = [],
  shareCode?: string | null
): Promise<AnswerResult> {
  const itinerary = itineraryJson as Itinerary

  // Fast gate: regex catches clean "show plan" requests (0 API calls)
  if (isFullPlanRequest(userQuestion)) {
    return buildLiffOrTextResult(itinerary, shareCode)
  }

  // Gemini call: classify intent + answer in one shot
  const recentHistory = chatHistory.slice(-MAX_HISTORY)
  const fastPrompt = buildContextPrompt(userQuestion, itineraryJson, '', recentHistory)
  const fastAnswer = await generateText(fastPrompt, { maxOutputTokens: 4096 })
  const trimmed = fastAnswer.trim()

  // Gemini classified as "show plan" request (catches typos, fuzzy intent)
  if (trimmed === '[SHOW_PLAN]') {
    return buildLiffOrTextResult(itinerary, shareCode)
  }

  // Check if the answer indicates info is not in the plan
  if (needsEnrichment(trimmed)) {
    return { answer: trimmed, needsFollowUp: true }
  }

  return { answer: trimmed, needsFollowUp: false }
}

function buildLiffOrTextResult(itinerary: Itinerary, shareCode?: string | null): AnswerResult {
  if (shareCode) {
    return {
      answer: '',
      needsFollowUp: false,
      liffView: {
        title: itinerary.title ?? 'แผนการเดินทาง',
        totalDays: itinerary.totalDays ?? itinerary.days?.length ?? 0,
        season: itinerary.season ?? '',
        shareCode,
      },
    }
  }
  // Fallback if no shareCode — send text
  return { answer: formatItinerary(itinerary), needsFollowUp: false }
}

// Second pass — single Gemini call with Google Search grounding + persona
export async function answerWithEnrichedContext(
  userQuestion: string,
  itineraryJson: object,
  chatHistory: ChatMessage[] = []
): Promise<string> {
  const noResults = 'ขออภัยครับ ผมค้นหาข้อมูลจากแหล่งภายนอกแล้ว แต่ไม่พบข้อมูลที่ตรงกับคำถามนี้ครับ ลองถามใหม่ในมุมอื่นได้นะครับ'

  const recentHistory = chatHistory.slice(-MAX_HISTORY)
  const prompt = buildEnrichedPrompt(userQuestion, itineraryJson, recentHistory)
  const answer = await generateWithSearch(prompt)
  const trimmed = answer.trim()

  if (!trimmed || needsEnrichment(trimmed)) return noResults
  return trimmed
}

// Save user message + bot reply to chat history
export async function saveChatHistory(
  lineId: string,
  userMessage: string,
  botReply: string
): Promise<void> {
  const context = await prisma.lineContext.findUnique({ where: { lineId } })
  if (!context) return

  const history = (context.chatHistory as ChatMessage[] | null) ?? []
  history.push({ role: 'user', content: userMessage })
  history.push({ role: 'bot', content: botReply })

  // Keep only last N messages
  const trimmed = history.slice(-MAX_HISTORY)

  await prisma.lineContext.update({
    where: { lineId },
    data: { chatHistory: trimmed as unknown as import('@prisma/client').Prisma.InputJsonValue },
  })
}

function buildContextPrompt(
  question: string,
  itinerary: object,
  extraContext: string,
  chatHistory: ChatMessage[] = []
): string {
  const extraSection = extraContext
    ? `\n\nข้อมูลเพิ่มเติม (ใช้ตอบถ้าคำถามไม่เกี่ยวกับแผนโดยตรง):\n${extraContext}`
    : ''

  const historySection = chatHistory.length > 0
    ? '\n\nบทสนทนาก่อนหน้า:\n' + chatHistory.map((m) =>
        m.role === 'user' ? `ผู้ใช้: ${m.content}` : `ไกด์: ${m.content}`
      ).join('\n')
    : ''

  return `คุณคือไกด์ท่องเที่ยวญี่ปุ่นส่วนตัว พูดเป็นมิตร สุภาพ ใช้คำลงท้ายเช่น "ครับ/นะครับ"

ขั้นตอนที่ 1 — จำแนกความต้องการ:
- ถ้าผู้ใช้ต้องการ "เปิดดู" แผนการเดินทางทั้งหมด (เช่น ขอดูแผน, ขอแพลน, show plan, need plan, plna pls, แม้สะกดผิด) → ตอบเพียงคำว่า [SHOW_PLAN] เท่านั้น ห้ามตอบอย่างอื่น
- ถ้าผู้ใช้ถามคำถามเกี่ยวกับทริป (รวมถึงสรุป, แนะนำ, ถามรายละเอียด, สรุปทริป) → ไปขั้นตอนที่ 2

ขั้นตอนที่ 2 — ตอบคำถาม:
ตอบกระชับแต่ให้ครบถ้วนเป็นธรรมชาติ (2-4 ประโยค) อย่าตอบแค่คำเดียว
ห้ามขึ้นต้นด้วยคำทักทายเช่น "สวัสดีครับ" — ตอบคำถามตรงๆ เลย

กฎสำคัญ:
- ตอบจากแผนการเดินทางและข้อมูลเพิ่มเติมที่ให้มาเท่านั้น
- ห้ามแต่งเรื่องหรือเดาข้อมูลที่ไม่มีในแผนหรือข้อมูลเพิ่มเติม เช่น ชื่อร้านอาหาร ราคา อุณหภูมิ
- ถ้าข้อมูลไม่มีในแผนและไม่มีข้อมูลเพิ่มเติม ให้ตอบว่า "ไม่มีข้อมูลในแผนของคุณ"
- แต่ถ้ามีข้อมูลเพิ่มเติมให้แล้วยังตอบไม่ได้ ให้ตอบว่า "ขออภัยครับ ผมค้นหาข้อมูลเพิ่มเติมแล้ว แต่ไม่พบคำตอบที่ชัดเจนสำหรับคำถามนี้ครับ"
- ใช้บทสนทนาก่อนหน้าเพื่อเข้าใจบริบท เช่น "แล้ววันถัดไปล่ะ" หมายถึงวันถัดจากที่เพิ่งพูดถึง

แผนการเดินทาง:
${JSON.stringify(itinerary)}${extraSection}${historySection}

คำถาม: ${question}`
}

function buildEnrichedPrompt(
  question: string,
  itinerary: object,
  chatHistory: ChatMessage[] = []
): string {
  const historySection = chatHistory.length > 0
    ? '\n\nบทสนทนาก่อนหน้า:\n' + chatHistory.map((m) =>
        m.role === 'user' ? `ผู้ใช้: ${m.content}` : `ไกด์: ${m.content}`
      ).join('\n')
    : ''

  return `คุณคือไกด์ท่องเที่ยวญี่ปุ่นส่วนตัว พูดเป็นมิตร สุภาพ ใช้คำลงท้ายเช่น "ครับ/นะครับ"
ตอบกระชับแต่ให้ครบถ้วนเป็นธรรมชาติ (2-4 ประโยค) อย่าตอบแค่คำเดียว
ห้ามขึ้นต้นด้วยคำทักทายเช่น "สวัสดีครับ" — ตอบคำถามตรงๆ เลย

คำถามนี้ไม่มีในแผนการเดินทางด้านล่าง ให้ค้นหาจาก Google Search แล้วตอบ
- ตอบจากข้อมูลที่ค้นหาจากเว็บเป็นหลัก
- ห้ามแต่งเรื่องหรือเดาข้อมูลที่ไม่พบจากการค้นหา
- ถ้าค้นหาแล้วยังตอบไม่ได้ ให้ตอบว่า "ไม่มีข้อมูล"
- ใช้บทสนทนาก่อนหน้าเพื่อเข้าใจบริบท

แผนการเดินทาง (อ้างอิง):
${JSON.stringify(itinerary)}${historySection}

คำถาม: ${question}`
}
