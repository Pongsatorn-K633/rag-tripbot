/**
 * One-off exporter: dump every pre-planned Template to JSON + a multi-sheet
 * Excel so the structure can be reviewed / restructured by hand.
 *
 *   npx tsx scripts/export-templates.ts
 *
 * Outputs into docs/template-structure/:
 *   - templates-as-is.json   (raw rows, faithful to the DB)
 *   - templates-as-is.xlsx   (relational sheets: Templates / Days / Activities /
 *                             Choices / AccommodationChoices + a Schema guide)
 */
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'
import { prisma } from '../lib/db/index.js'

type Range = { from?: string; to?: string }
function fmtRanges(arr: unknown): string {
  return Array.isArray(arr) && arr.length
    ? (arr as Range[]).map((r) => `${r.from}~${r.to}`).join('; ')
    : ''
}

async function main() {
  const templates = await prisma.template.findMany({ orderBy: { createdAt: 'asc' } })

  const outDir = join(process.cwd(), 'docs', 'template-structure')
  mkdirSync(outDir, { recursive: true })

  // ── Raw JSON (faithful) ──────────────────────────────────────────────────
  writeFileSync(join(outDir, 'templates-as-is.json'), JSON.stringify(templates, null, 2), 'utf8')

  // ── Relational rows for Excel ────────────────────────────────────────────
  const tplRows: Record<string, unknown>[] = []
  const dayRows: Record<string, unknown>[] = []
  const actRows: Record<string, unknown>[] = []
  const choiceRows: Record<string, unknown>[] = []
  const accomRows: Record<string, unknown>[] = []

  templates.forEach((t, i) => {
    const key = `${i + 1}. ${t.title}`
    const itin = (t.itinerary ?? {}) as {
      title?: string; totalDays?: number; season?: string
      days?: Array<{
        day: number; location?: string; accommodation?: string | null
        transport?: string; transportNotes?: string; free?: boolean
        activities?: Array<{ time?: string; name?: string; notes?: string; priority?: string; category?: string; cost?: string; duration?: string }>
        choices?: Array<{ label?: string; priority?: string; category?: string; selected?: number; options?: Array<{ name?: string; notes?: string; cost?: string; time?: string }> }>
        accommodationChoices?: Array<{ name?: string; tier?: string; cost?: string; notes?: string }>
      }>
    }
    const av = (t.availability ?? {}) as { available?: Range[]; recommended?: Range[]; note?: string }

    tplRows.push({
      '#': i + 1,
      template: t.title,
      description: t.description ?? '',
      totalDays: t.totalDays,
      season: t.season ?? '',
      shareCode: t.shareCode ?? '',
      available_ranges: fmtRanges(av.available),
      recommended_ranges: fmtRanges(av.recommended),
      availability_note: av.note ?? '',
      coverImage: t.coverImage ?? '',
      published: t.published,
    })

    for (const d of itin.days ?? []) {
      dayRows.push({
        template: key,
        day: d.day,
        location: d.location ?? '',
        free_day: d.free ? 'yes' : '',
        accommodation: d.accommodation ?? '',
        transport: d.transport ?? '',
        transportNotes: d.transportNotes ?? '',
        activities_count: d.activities?.length ?? 0,
        choices_count: d.choices?.length ?? 0,
      })

      ;(d.activities ?? []).forEach((a, ai) => {
        actRows.push({
          template: key, day: d.day, order: ai + 1,
          time: a.time ?? '', name: a.name ?? '', notes: a.notes ?? '',
          priority: a.priority ?? '', category: a.category ?? '',
          cost: a.cost ?? '', duration: a.duration ?? '',
        })
      })

      for (const c of d.choices ?? []) {
        ;(c.options ?? []).forEach((o, oi) => {
          choiceRows.push({
            template: key, day: d.day,
            choice_label: c.label ?? '', choice_priority: c.priority ?? '', choice_category: c.category ?? '',
            selected: c.selected === oi ? 'yes' : '',
            option_order: oi + 1, option_name: o.name ?? '', option_notes: o.notes ?? '',
            option_time: o.time ?? '', option_cost: o.cost ?? '',
          })
        })
      }

      for (const ac of d.accommodationChoices ?? []) {
        accomRows.push({
          template: key, day: d.day,
          name: ac.name ?? '', tier: ac.tier ?? '', cost: ac.cost ?? '', notes: ac.notes ?? '',
        })
      }
    }
  })

  const schemaRows = [
    { sheet: 'Templates', field: 'template', meaning: 'Trip title (join key across sheets is "#. title")' },
    { sheet: 'Templates', field: 'totalDays', meaning: 'Number of days in the plan' },
    { sheet: 'Templates', field: 'season', meaning: 'Winter / Spring / Summer / Autumn (optional label)' },
    { sheet: 'Templates', field: 'shareCode', meaning: 'Canonical LINE activation code (PREFIX-XXXX)' },
    { sheet: 'Templates', field: 'available_ranges', meaning: 'When the trip is open. MM-DD~MM-DD; … (year-agnostic). Empty = all year' },
    { sheet: 'Templates', field: 'recommended_ranges', meaning: 'Best time(s) to go → drives the "เหมาะกับวันที่คุณเลือก" badge' },
    { sheet: 'Days', field: 'location', meaning: 'Primary city/area for the day' },
    { sheet: 'Days', field: 'free_day', meaning: '"yes" = appended free day (user fills it in)' },
    { sheet: 'Activities', field: 'priority', meaning: 'mandatory | recommended | optional' },
    { sheet: 'Activities', field: 'category', meaning: 'flight | transport | sightseeing | food | shopping | accommodation | experience | other' },
    { sheet: 'Choices', field: 'choice_label', meaning: 'Pick-one-of-N group (e.g. "ร้านอาหารเย็น"); each row = one option' },
    { sheet: 'Choices', field: 'selected', meaning: '"yes" = the option pre-selected in this template' },
    { sheet: 'AccommodationChoices', field: 'tier', meaning: 'Budget / Mid-range / Luxury (optional)' },
  ]

  const wb = XLSX.utils.book_new()
  const add = (name: string, rows: Record<string, unknown>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ '(empty)': '' }]), name)
  add('Templates', tplRows)
  add('Days', dayRows)
  add('Activities', actRows)
  add('Choices', choiceRows)
  add('AccommodationChoices', accomRows)
  add('Schema', schemaRows)
  XLSX.writeFile(wb, join(outDir, 'templates-as-is.xlsx'))

  console.log(`Exported ${templates.length} template(s)`)
  console.log(`  days=${dayRows.length} activities=${actRows.length} choiceOptions=${choiceRows.length} accomChoices=${accomRows.length}`)
  console.log(`  → docs/template-structure/templates-as-is.json`)
  console.log(`  → docs/template-structure/templates-as-is.xlsx`)
}

main()
  .catch((e) => { console.error('Export failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
