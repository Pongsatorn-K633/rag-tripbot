import { generateFromOllama } from '../llm/client'
import { embedText } from '../rag/embedder'
import { searchWeb } from '../rag/web-search'
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
  /ขอ(ดู)?(แผน|แพลน)/, /(แผน|แพลน)ทั้งหมด/, /ดู(แผน|แพลน)ทั้งหมด/,
  /ทริปนี้ไปไหนบ้าง/, /ขอ(แผน|แพลน)(ท่องเที่ยว|เที่ยว)/, /สรุปทริป/,
  /ขอดูทริป/, /(แผน|แพลน)การเดินทาง(ทั้งหมด)?$/,
  /show\s*(me\s*)?(the\s*)?plan/i, /full\s*plan/i, /trip\s*plan\??$/i,
  /ขอดูทั้งหมด/, /ไปไหนบ้าง$/,
]

function isFullPlanRequest(message: string): boolean {
  const trimmed = message.trim()
  return FULL_PLAN_PATTERNS.some((p) => p.test(trimmed))
}

function formatItinerary(itinerary: Itinerary): string {
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

async function fetchExtraContext(question: string): Promise<string> {
  // Run pgvector search and Tavily in parallel
  const [blocks, webResults] = await Promise.all([
    searchBlocks(question),
    searchWeb(`Japan ${question.slice(0, 100)}`),
  ])

  const parts: string[] = []

  if (blocks.length > 0) {
    parts.push('ข้อมูลจากฐานข้อมูล:\n' + blocks.map((b) => b.content).join('\n---\n'))
  }

  if (webResults.length > 0) {
    parts.push('ข้อมูลล่าสุดจากเว็บ:\n' + webResults.map((r) => `${r.title}: ${r.content}`).join('\n'))
  }

  return parts.join('\n\n')
}

async function searchBlocks(query: string): Promise<{ content: string }[]> {
  try {
    const embedding = await embedText(query)
    const vectorStr = `[${embedding.join(',')}]`
    return await prisma.$queryRaw<{ content: string }[]>`
      SELECT content
      FROM itinerary_blocks
      WHERE 1 - (embedding <=> ${vectorStr}::vector) > 0.3
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 3
    `
  } catch {
    return []
  }
}

export interface ChatMessage {
  role: 'user' | 'bot'
  content: string
}

const MAX_HISTORY = 10  // keep last 10 messages (5 pairs)

export interface AnswerResult {
  answer: string
  needsFollowUp: boolean  // true = fast answer was insufficient, enriched answer coming
}

// Quick first pass — answers from itinerary only
export async function answerWithContext(
  userQuestion: string,
  itineraryJson: object,
  chatHistory: ChatMessage[] = []
): Promise<AnswerResult> {
  // Step 1: Classify intent — is this a "show full plan" request?
  const wantsFullPlan = isFullPlanRequest(userQuestion)

  if (wantsFullPlan) {
    return { answer: formatItinerary(itineraryJson as Itinerary), needsFollowUp: false }
  }

  // Step 2: Try answering from itinerary alone (fast path)
  const recentHistory = chatHistory.slice(-MAX_HISTORY)
  const fastPrompt = buildContextPrompt(userQuestion, itineraryJson, '', recentHistory)
  const fastAnswer = await generateFromOllama(fastPrompt)
  const trimmed = fastAnswer.trim()

  // Step 3: Check if the answer indicates info is not in the plan
  if (needsEnrichment(trimmed)) {
    return { answer: trimmed, needsFollowUp: true }
  }

  return { answer: trimmed, needsFollowUp: false }
}

// Second pass — enrich with pgvector + Tavily, only called when needed
export async function answerWithEnrichedContext(
  userQuestion: string,
  itineraryJson: object,
  chatHistory: ChatMessage[] = []
): Promise<string> {
  const extraContext = await fetchExtraContext(userQuestion)
  const noResults = 'ขออภัยครับ ผมค้นหาข้อมูลจากแหล่งภายนอกแล้ว แต่ไม่พบข้อมูลที่ตรงกับคำถามนี้ครับ ลองถามใหม่ในมุมอื่นได้นะครับ'
  if (!extraContext) return noResults

  const recentHistory = chatHistory.slice(-MAX_HISTORY)
  const enrichedPrompt = buildEnrichedPrompt(userQuestion, itineraryJson, extraContext, recentHistory)
  const enrichedAnswer = await generateFromOllama(enrichedPrompt)
  const trimmed = enrichedAnswer.trim()

  // If LLM still couldn't answer, override with a clear message
  if (needsEnrichment(trimmed)) return noResults
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
    data: { chatHistory: trimmed },
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
ตอบกระชับแต่ให้ครบถ้วนเป็นธรรมชาติ (2-4 ประโยค) อย่าตอบแค่คำเดียว

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
  extraContext: string,
  chatHistory: ChatMessage[] = []
): string {
  const historySection = chatHistory.length > 0
    ? '\n\nบทสนทนาก่อนหน้า:\n' + chatHistory.map((m) =>
        m.role === 'user' ? `ผู้ใช้: ${m.content}` : `ไกด์: ${m.content}`
      ).join('\n')
    : ''

  return `คุณคือไกด์ท่องเที่ยวญี่ปุ่นส่วนตัว พูดเป็นมิตร สุภาพ ใช้คำลงท้ายเช่น "ครับ/นะครับ"
ตอบกระชับแต่ให้ครบถ้วนเป็นธรรมชาติ (2-4 ประโยค) อย่าตอบแค่คำเดียว

คำถามนี้ไม่มีในแผนการเดินทาง แต่เราค้นหาข้อมูลเพิ่มเติมมาให้แล้ว
- ตอบจากข้อมูลเพิ่มเติมที่ค้นหามาเป็นหลัก
- ห้ามแต่งเรื่องหรือเดาข้อมูลที่ไม่มีในข้อมูลที่ให้มา
- ถ้าข้อมูลที่ค้นมายังตอบไม่ได้ ให้ตอบว่า "ไม่มีข้อมูล"
- ใช้บทสนทนาก่อนหน้าเพื่อเข้าใจบริบท

แผนการเดินทาง (อ้างอิง):
${JSON.stringify(itinerary)}

ข้อมูลที่ค้นหามา:
${extraContext}${historySection}

คำถาม: ${question}`
}
