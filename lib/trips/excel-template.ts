import * as XLSX from 'xlsx'
import type {
  ItineraryV2, DayV2, Slot, NodeSnap, ActivityV2, Meals, ActivityPriority, DateRange,
} from '@/lib/itinerary-types'
import { seasonsForRanges } from '@/lib/availability'

/**
 * Deterministic parser for the dopamichi Excel itinerary template (the layout
 * produced by scripts/build-itinerary-template.ts). When an uploaded workbook
 * matches the template, we build a v2 (node/slot) itinerary directly — exact,
 * instant, free — and skip the LLM. Non-template spreadsheets → returns null so
 * the caller falls back to the Gemini extraction path.
 *
 * The template has two data sheets:
 *   - "Trip"       — key/value meta (Title, Area code, Available, Recommended, Cover images)
 *   - "Itinerary"  — one row per node (Day, Location, Slot, Time, Priority, Category, …)
 * The Slot column routes a node to meal slots / timeline / accommodation, exactly
 * like the Trip Builder; a `log.*` Category makes it a logistics node.
 */

export const TEMPLATE_SHEETS = { trip: 'Trip', itinerary: 'Itinerary', legend: 'Legend' } as const

/** Canonical column order for the Itinerary sheet (also used by the generator). */
export const ITINERARY_HEADERS = [
  'Day', 'Location', 'Free', 'Slot', 'Time', 'Priority', 'Category',
  'Name (EN)', 'Name (TH)', 'Emoji', 'Cost', 'Duration', 'Notes', 'Map URL',
  'Choice group', 'Default?',
] as const

export interface TemplateMeta {
  title: string
  areaCode?: string
  coverImages: string[]
  availability: { available: DateRange[]; recommended: DateRange[] }
}

// ── header mapping (tolerant to caption variations / order) ───────────────────

const COL_ALIASES: Record<string, string[]> = {
  day: ['day'],
  location: ['location', 'city'],
  free: ['free', 'freeday'],
  slot: ['slot'],
  time: ['time'],
  priority: ['priority'],
  category: ['category', 'categorycode'],
  nameEn: ['nameen', 'name'],
  nameTh: ['nameth'],
  emoji: ['emoji'],
  cost: ['cost', 'price'],
  duration: ['duration'],
  notes: ['notes', 'note'],
  mapUrl: ['mapurl', 'map', 'maplink'],
  choiceGroup: ['choicegroup', 'choice', 'group'],
  selected: ['default', 'selected'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

type ColMap = Partial<Record<keyof typeof COL_ALIASES, number>>

function mapHeaders(header: string[]): ColMap {
  const map: ColMap = {}
  header.forEach((h, i) => {
    const n = norm(h)
    for (const key of Object.keys(COL_ALIASES)) {
      if (COL_ALIASES[key].includes(n) && map[key as keyof ColMap] === undefined) {
        map[key as keyof ColMap] = i
      }
    }
  })
  return map
}

// ── small value normalizers ───────────────────────────────────────────────────

const TRUTHY = /^(y|yes|true|1|✓|✔|x|มี|ใช่)$/i
const pad = (n: string | number) => String(n).padStart(2, '0')

function slotKey(s: string): 'breakfast' | 'lunch' | 'dinner' | 'accommodation' | 'timeline' {
  const n = s.toLowerCase()
  if (/break|เช้า/.test(n)) return 'breakfast'
  if (/lunch|กลางวัน|เที่ยง/.test(n)) return 'lunch'
  if (/dinner|เย็น|ค่ำ/.test(n)) return 'dinner'
  if (/accom|stay|hotel|ที่พัก|พัก/.test(n)) return 'accommodation'
  return 'timeline'
}

function priorityOf(s: string): ActivityPriority | undefined {
  const n = s.toLowerCase()
  if (/must|mandat|ต้อง|ห้ามพลาด/.test(n)) return 'mandatory'
  if (/recommend|แนะนำ/.test(n)) return 'recommended'
  if (/option|เสริม/.test(n)) return 'optional'
  return undefined
}

/** Parse "03-25 → 04-15 ; 10-01 to 11-20" → DateRange[] (each "MM-DD"). */
function parseRanges(s: string): DateRange[] {
  if (!s) return []
  const out: DateRange[] = []
  const re = /(\d{1,2})\s*-\s*(\d{1,2})\s*(?:→|->|=>|–|—|~|to|ถึง)\s*(\d{1,2})\s*-\s*(\d{1,2})/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    out.push({ from: `${pad(m[1])}-${pad(m[2])}`, to: `${pad(m[3])}-${pad(m[4])}` })
  }
  return out
}

// ── sheet helpers ─────────────────────────────────────────────────────────────

function sheetRows(sheet: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as unknown[][]
  return aoa.map((r) => r.map((c) => (c == null ? '' : String(c)).trim()))
}

function findSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet | null {
  const match = wb.SheetNames.find((n) => norm(n) === norm(name))
  return match ? wb.Sheets[match] : null
}

function readTripMeta(wb: XLSX.WorkBook): Omit<TemplateMeta, 'title'> & { title?: string } {
  const sheet = findSheet(wb, TEMPLATE_SHEETS.trip)
  const meta: Omit<TemplateMeta, 'title'> & { title?: string } = {
    coverImages: [], availability: { available: [], recommended: [] },
  }
  if (!sheet) return meta
  for (const row of sheetRows(sheet)) {
    const key = norm(row[0] ?? '')
    const val = (row[1] ?? '').trim()
    if (!val) continue
    if (key === 'title') meta.title = val
    else if (key === 'areacode' || key === 'area' || key === 'provincecode') meta.areaCode = val.toUpperCase()
    else if (key === 'available') meta.availability.available = parseRanges(val)
    else if (key === 'recommended') meta.availability.recommended = parseRanges(val)
    else if (key === 'coverimages' || key === 'coverimage' || key === 'cover') {
      meta.coverImages = val.split(/[;\n]/).map((u) => u.trim()).filter(Boolean)
    }
  }
  return meta
}

// ── slot building ─────────────────────────────────────────────────────────────

interface NodeRow { node: NodeSnap; choiceGroup: string; selected: boolean }

function buildSlot(rows: NodeRow[], defaultLabel?: string): Slot | null {
  if (rows.length === 0) return null
  if (rows.length === 1 && !rows[0].choiceGroup) return { kind: 'single', node: rows[0].node }
  const selIdx = rows.findIndex((r) => r.selected)
  return {
    kind: 'choice',
    label: rows.find((r) => r.choiceGroup)?.choiceGroup || defaultLabel,
    selected: selIdx >= 0 ? selIdx : null,
    options: rows.map((r) => r.node),
  }
}

const MEAL_LABEL = { breakfast: '🍳 มื้อเช้า', lunch: '🍱 มื้อกลางวัน', dinner: '🍽️ มื้อเย็น' } as const

// ── main parse ────────────────────────────────────────────────────────────────

/** Parse a workbook in dopamichi template format → v2 itinerary, or null if it
 *  doesn't match the template (caller should fall back to LLM extraction). */
export function parseTemplateWorkbook(wb: XLSX.WorkBook): { itinerary: ItineraryV2; meta: TemplateMeta } | null {
  const itinSheet = findSheet(wb, TEMPLATE_SHEETS.itinerary)
  if (!itinSheet) return null

  const rows = sheetRows(itinSheet)
  if (rows.length < 2) return null
  const col = mapHeaders(rows[0])
  if (col.day === undefined || col.slot === undefined || col.nameEn === undefined) return null // not our template

  const cell = (row: string[], key: keyof ColMap) => {
    const i = col[key]
    return i === undefined ? '' : (row[i] ?? '').trim()
  }

  // Per-day accumulators (preserve row order for the timeline + choice options).
  interface DayAcc {
    day: number; location: string; free: boolean
    meals: { breakfast: NodeRow[]; lunch: NodeRow[]; dinner: NodeRow[] }
    accommodation: NodeRow[]; activities: ActivityV2[]
  }
  const byDay = new Map<number, DayAcc>()
  let curDay = 0

  for (const row of rows.slice(1)) {
    const dayCell = cell(row, 'day')
    if (dayCell) { const n = parseInt(dayCell, 10); if (!Number.isNaN(n)) curDay = n }
    const name = cell(row, 'nameEn')
    if (!name) continue // blank/spacer row
    if (curDay === 0) curDay = 1

    let acc = byDay.get(curDay)
    if (!acc) {
      acc = {
        day: curDay, location: '', free: false,
        meals: { breakfast: [], lunch: [], dinner: [] }, accommodation: [], activities: [],
      }
      byDay.set(curDay, acc)
    }
    const loc = cell(row, 'location'); if (loc) acc.location = loc
    if (TRUTHY.test(cell(row, 'free'))) acc.free = true

    const node: NodeSnap = { nodeId: null, name, categoryCode: cell(row, 'category') || 'exp.other' }
    const nameTh = cell(row, 'nameTh'); if (nameTh) node.nameTh = nameTh
    const emoji = cell(row, 'emoji'); if (emoji) node.emoji = emoji
    const notes = cell(row, 'notes'); if (notes) node.notes = notes
    const cost = cell(row, 'cost'); if (cost) node.cost = cost
    const duration = cell(row, 'duration'); if (duration) node.duration = duration
    const time = cell(row, 'time'); if (time) node.time = time
    const mapUrl = cell(row, 'mapUrl'); if (mapUrl) node.mapUrl = mapUrl

    const key = slotKey(cell(row, 'slot'))
    if (key === 'timeline') {
      const a: ActivityV2 = { node }
      if (time) a.time = time
      const pr = priorityOf(cell(row, 'priority')); if (pr) a.priority = pr
      acc.activities.push(a)
    } else {
      const nr: NodeRow = { node, choiceGroup: cell(row, 'choiceGroup'), selected: TRUTHY.test(cell(row, 'selected')) }
      if (key === 'accommodation') acc.accommodation.push(nr)
      else acc.meals[key].push(nr)
    }
  }

  if (byDay.size === 0) return null

  const ordered = [...byDay.values()].sort((a, b) => a.day - b.day)
  const days: DayV2[] = ordered.map((acc, i) => {
    const meals: Meals = {
      breakfast: buildSlot(acc.meals.breakfast, MEAL_LABEL.breakfast),
      lunch: buildSlot(acc.meals.lunch, MEAL_LABEL.lunch),
      dinner: buildSlot(acc.meals.dinner, MEAL_LABEL.dinner),
    }
    const activities = [...acc.activities].sort((a, b) =>
      (a.time ?? '').localeCompare(b.time ?? '') || 0)
    const day: DayV2 = {
      day: i + 1, location: acc.location, meals, activities,
      accommodation: buildSlot(acc.accommodation), transport: [],
    }
    if (acc.free) day.free = true
    return day
  })

  const meta0 = readTripMeta(wb)
  const meta: TemplateMeta = {
    title: meta0.title || days[0]?.location || 'Imported itinerary',
    areaCode: meta0.areaCode,
    coverImages: meta0.coverImages,
    availability: meta0.availability,
  }
  const season =
    seasonsForRanges(meta.availability.recommended)[0] ??
    seasonsForRanges(meta.availability.available)[0]

  const itinerary: ItineraryV2 = {
    version: 2,
    title: meta.title,
    totalDays: days.length,
    ...(season ? { season } : {}),
    days,
  }
  return { itinerary, meta }
}
