/**
 * Generates the BLANK dopamichi Excel itinerary template:
 *   public/dopamichi-itinerary-template.xlsx
 *
 * Three sheets — Trip (empty meta), Itinerary (blank 7-day scaffold), Legend.
 * The layout mirrors the Trip Builder and is parsed deterministically by
 * lib/trips/excel-template.ts (no LLM). Run:  npx tsx scripts/build-itinerary-template.ts
 *
 * NOTE: headers are inlined (kept in sync with ITINERARY_HEADERS in
 * lib/trips/excel-template.ts) so this generator stays dependency-free.
 */
import * as XLSX from 'xlsx'
import { resolve } from 'node:path'

const ITINERARY_HEADERS = [
  'Day', 'Location', 'Free', 'Slot', 'Time', 'Priority', 'Category',
  'Name (EN)', 'Name (TH)', 'Emoji', 'Cost', 'Duration', 'Notes', 'Map URL',
  'Choice group', 'Default?',
]

const DAYS = 7
// Canonical slot scaffold per day — pre-fills Day + Slot, leaves everything else
// blank for the user to fill. Add/remove Timeline rows as needed.
const DAY_SLOTS = ['Breakfast', 'Timeline', 'Timeline', 'Lunch', 'Timeline', 'Timeline', 'Dinner', 'Accommodation']

const ITINERARY_ROWS: (string | number)[][] = []
for (let d = 1; d <= DAYS; d++) {
  DAY_SLOTS.forEach((slot, i) => {
    const row: (string | number)[] = new Array(ITINERARY_HEADERS.length).fill('')
    if (i === 0) row[0] = d // Day number on the first row of each day (rest inherit)
    row[3] = slot           // Slot column
    ITINERARY_ROWS.push(row)
  })
}

const TRIP_ROWS: string[][] = [
  ['Field', 'Value'],
  ['Title', ''],
  ['Area code', ''],
  ['Available', ''],
  ['Recommended', ''],
  ['Cover images', ''],
]

const LEGEND_ROWS: string[][] = [
  ['dopamichi · Itinerary template — how to fill', ''],
  ['', ''],
  ['SHEETS', ''],
  ['Trip', 'Meta key/value. Title required. Area code = province prefix for the trip code (e.g. KYO → KYO-001). Available / Recommended = "MM-DD → MM-DD" windows (season is auto-derived). Cover images = URLs separated by ";".'],
  ['Itinerary', 'One row PER node. Fill Day + Location on the first row of each day; leave them blank on the rows below — they inherit. Blank rows (no Name) are ignored.'],
  ['', ''],
  ['COLUMN: Slot — where the node goes (like the builder)', ''],
  ['Breakfast / Lunch / Dinner', 'The three core meal slots.'],
  ['Brunch / Afternoon / Late night', 'Optional extra meals (มื้อสาย / มื้อบ่าย / มื้อดึก) — add a row with this Slot only when you need it.'],
  ['Timeline', 'The ordered activity timeline (sorted by Time).'],
  ['Accommodation', 'Where you stay that night.'],
  ['', ''],
  ['COLUMN: Category — root prefix decides how it renders', ''],
  ['log.*', 'Logistics node → compact transport/connector row in the timeline (train, bus, walk). e.g. log.rail.jr, log.bus.city, log.walk'],
  ['live.*', 'Accommodation. e.g. live.stay.hotel'],
  ['food.*', 'Meal / café / dessert. e.g. food.dine.ramen, food.cafe'],
  ['exp.*', 'Sightseeing / activity. e.g. exp.land.temple, exp.act.boat'],
  ['shop.*', 'Shopping. e.g. shop.tea, shop.mall'],
  ['', ''],
  ['COLUMN: Priority — timeline nodes only', ''],
  ['Must / Recommend / Optional', 'The must-do / recommended / optional badge. Blank = Optional.'],
  ['', ''],
  ['COLUMN: Choice group + Default? — pick-one options (meals & accommodation)', ''],
  ['Choice group', 'Give 2+ rows in the SAME day + slot the same label (e.g. "dinner") to turn them into a pick-one choice.'],
  ['Default?', 'Put Y on the option that should be pre-selected.'],
  ['', ''],
  ['OTHER COLUMNS', ''],
  ['Time', 'HH:MM (24h). Name (EN) / (TH), Emoji, Cost (e.g. ¥1,500 / Free), Duration (e.g. 1.5h), Notes, Map URL — all optional per node.'],
  ['Free', 'Put Y to mark the whole day as a free/open day.'],
]

function aoaSheet(rows: (string | number)[][], cols?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  if (cols) ws['!cols'] = cols.map((wch) => ({ wch }))
  return ws
}

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, aoaSheet(TRIP_ROWS, [16, 40]), 'Trip')
XLSX.utils.book_append_sheet(
  wb,
  aoaSheet([ITINERARY_HEADERS, ...ITINERARY_ROWS], [5, 12, 5, 13, 6, 10, 16, 22, 22, 6, 9, 9, 28, 30, 12, 8]),
  'Itinerary',
)
XLSX.utils.book_append_sheet(wb, aoaSheet(LEGEND_ROWS, [44, 90]), 'Legend')

const out = resolve(process.cwd(), 'public', 'dopamichi-itinerary-template.xlsx')
XLSX.writeFile(wb, out)
console.log(`Wrote ${out}  (blank ${DAYS}-day scaffold, ${ITINERARY_ROWS.length} rows)`)
