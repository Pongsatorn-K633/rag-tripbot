/**
 * Re-prefix personal trip codes to match their template's PROVINCE.
 *
 *   npx tsx prisma/seed/sync-personal-code-prefixes.ts          # DRY RUN
 *   npx tsx prisma/seed/sync-personal-code-prefixes.ts --apply  # writes
 *
 * Old duplicates derived their prefix from the first CITY (Sapporo→SAP) while the
 * template now uses the province (Hokkaido→HOK). This regenerates a fresh
 * high-entropy code with the template's province prefix (SAP-XHDA → HOK-9K2M) so
 * the plan is consistent everywhere. Only touches trips whose prefix differs.
 * Existing LINE bindings survive (bound by trip id).
 */
import 'dotenv/config'
import { prisma } from '../../lib/db/index.js'
import { generateUniqueShareCode } from '../../lib/share-code.js'

const APPLY = process.argv.includes('--apply')

async function main() {
  const trips = await prisma.trip.findMany({
    where: { source: 'plan', shareCode: { not: null }, templateId: { not: null } },
  })

  for (const t of trips) {
    const tpl = await prisma.template.findUnique({ where: { id: t.templateId! }, select: { shareCode: true } })
    if (!tpl?.shareCode) { console.log(`skip ${t.shareCode} — template has no code`); continue }
    const want = tpl.shareCode.split('-')[0]      // province prefix, e.g. HOK
    const have = t.shareCode!.split('-')[0]
    if (have === want) { console.log(`ok   ${t.shareCode} — already ${want}`); continue }

    const newCode = APPLY ? await generateUniqueShareCode(want) : `${want}-????`
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${t.shareCode} → ${newCode}  ("${t.title}")`)
    if (APPLY) await prisma.trip.update({ where: { id: t.id }, data: { shareCode: newCode } })
  }

  console.log(APPLY ? '\nApplied.' : '\nDry run — re-run with --apply to write.')
}

main()
  .catch((e) => { console.error('Sync failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
