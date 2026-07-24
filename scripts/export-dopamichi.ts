/**
 * Export a DB's TKY-001 itinerary → data/snapshots/tokyo-nagano.json
 * (machine-managed snapshot — humans and AI never hand-edit it; see .claude/settings.json deny rules)
 * using the dashboard's own exporter (toAuthoringJson), so the file keeps the
 * authoring shape + source_file (import idempotency key).
 *
 * This is /ship's step 0: the PROD DB is canonical (authoring happens on the
 * prod dashboard); the JSON is its snapshot; the dev DB follows.
 * Run: USE_PROD_DB=1 npx tsx scripts/export-dopamichi.ts   (no flag = snapshot dev)
 */
import './load-env.js' // .env.local (dev branch) wins over .env
import { writeFileSync } from 'fs'
import { prisma } from '../lib/db/index.js'
import { toAuthoringJson } from '../lib/trips/plan-json.js'
import type { ItineraryV3 } from '../lib/itinerary-types.js'

const OUT = 'data/snapshots/tokyo-nagano.json'

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
