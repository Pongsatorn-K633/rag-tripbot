/**
 * Renumber existing template share codes to the incremental province scheme
 * (KYO-747 → KYO-001, SAP-199 → HOK-001). Updates the Template AND its system
 * bridge Trip atomically so the LIFF "view plan" + LINE lookup keep working.
 *
 *   npx tsx prisma/seed/renumber-template-codes.ts          # DRY RUN
 *   npx tsx prisma/seed/renumber-template-codes.ts --apply  # writes changes
 *
 * Personal user trips are untouched (they keep their high-entropy codes).
 * Existing LINE bindings survive — LineContext points by tripId, not by code.
 */
import 'dotenv/config'
import { prisma } from '../../lib/db/index.js'

const APPLY = process.argv.includes('--apply')

// Province prefix for each existing template, keyed by its CURRENT share code.
const PROVINCE_BY_CODE: Record<string, string> = {
  'KYO-747': 'KYO', // Kyoto
  'SAP-199': 'HOK', // Hokkaido (province-level, not Sapporo the city)
}

async function main() {
  const templates = await prisma.template.findMany({
    where: { shareCode: { not: null } },
    orderBy: { createdAt: 'asc' },
  })

  // Fresh per-province counter so the first of each province starts at 001.
  // (Can't use generateIncrementalTemplateCode here — it would count the OLD
  // numeric code we're replacing, e.g. KYO-747 → KYO-748 instead of KYO-001.)
  const counter: Record<string, number> = {}

  for (const t of templates) {
    const oldCode = t.shareCode!
    const province = PROVINCE_BY_CODE[oldCode]
    if (!province) {
      console.log(`skip   "${t.title}" (${oldCode}) — no province mapping`)
      continue
    }
    counter[province] = (counter[province] ?? 0) + 1
    const newCode = `${province}-${String(counter[province]).padStart(3, '0')}`
    console.log(`${APPLY ? 'RENUMBER' : 'DRY     '} "${t.title}": ${oldCode} → ${newCode}`)
    if (APPLY) {
      await prisma.$transaction([
        prisma.template.update({ where: { id: t.id }, data: { shareCode: newCode } }),
        prisma.trip.updateMany({
          where: { shareCode: oldCode, source: 'template' },
          data: { shareCode: newCode },
        }),
      ])
    }
  }

  console.log('')
  console.log(APPLY ? 'Applied.' : 'Dry run — re-run with --apply to write.')
}

main()
  .catch((e) => { console.error('Renumber failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
