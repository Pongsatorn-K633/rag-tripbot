/**
 * Export the DEV DB's TKY-001 itinerary → docs/pre-planned-trip/Dopamichi-update.json
 * using the dashboard's own exporter (toAuthoringJson), so the file keeps the
 * authoring shape + source_file (import idempotency key).
 *
 * This is /ship's step 0: the dev DB is canonical; the JSON is its snapshot.
 * Run: npx tsx scripts/export-dopamichi.ts   (add USE_PROD_DB=1 to snapshot prod instead)
 */
import './load-env.js' // .env.local (dev branch) wins over .env
import { writeFileSync } from 'fs'
import { prisma } from '../lib/db/index.js'
import { toAuthoringJson } from '../lib/trips/plan-json.js'
import type { ItineraryV3 } from '../lib/itinerary-types.js'

const OUT = 'docs/pre-planned-trip/Dopamichi-update.json'

async function main() {
  const t = await prisma.template.findFirst({
    where: { shareCode: 'TKY-001' },
    select: { title: true, itinerary: true },
  })
  if (!t) throw new Error('TKY-001 not found on this branch')
  const itin = t.itinerary as unknown as ItineraryV3
  if (itin.version !== 3) throw new Error('Not a V3 itinerary — refusing to export')
  writeFileSync(OUT, JSON.stringify(toAuthoringJson(itin), null, 2) + '\n')
  console.log(`Exported "${t.title}" → ${OUT}`)
}

main()
  .catch((e) => {
    console.error('ERR', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
