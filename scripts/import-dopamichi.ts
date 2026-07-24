/**
 * Import a transformer plan JSON into a draft pre-planned Template (V3 itinerary).
 * Idempotent: a prior import with the same sourceFile is UPDATED IN PLACE — never
 * delete-recreated — so Trips linked to the template (user duplicates with their
 * edits, LINE activations) and the share code all survive a re-import. Saves as a
 * DRAFT (published:false) unless --publish.
 *
 *   npx tsx scripts/import-dopamichi.ts [path/to/discover.json]
 */
import './load-env.js' // .env.local (dev branch) wins over .env — never import to prod by accident
import { readFileSync } from 'fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/db/index.js'
import { generateShareCodeForTemplate, getSystemUserId, syncBridgeTrip } from '../lib/share-code.js'
import { importPlanJson, deriveAvailability } from '../lib/trips/import-plan.js'

const args = process.argv.slice(2)
const PUBLISH = args.includes('--publish') // publish so it shows on /discover (no login)
const SRC = args.find((a) => !a.startsWith('--')) ?? 'data/snapshots/tokyo-nagano.json'
const PREFIX = 'TKY' // area_code is "(fill in app)" in the source; admin sets the real one later

async function main() {
  // Safety: confirm which DB this is hitting (host only, no credentials).
  const host = process.env.DATABASE_URL?.match(/@([^/?]+)/)?.[1] ?? '(unknown)'
  console.log(`DB host: ${host}`)
  if (host.includes('twilight-hall') && process.env.USE_PROD_DB !== '1') {
    console.error('REFUSING: that is the PRODUCTION endpoint. To import to prod intentionally, run with USE_PROD_DB=1.')
    process.exit(1)
  }
  if (process.env.USE_PROD_DB === '1') console.log('⚠️  TARGETING PRODUCTION DB (USE_PROD_DB=1)')

  const raw = JSON.parse(readFileSync(SRC, 'utf8'))
  const itinerary = importPlanJson(raw)
  const availability = deriveAvailability(itinerary)
  const systemUserId = await getSystemUserId()

  // Find a prior import of THIS source file. Matching on the stable sourceFile
  // (not title) keeps re-import idempotent even if you edit the title. The prior
  // row is UPDATED IN PLACE — deleting it would take down every Trip a user
  // duplicated from it (and their edits + LINE activations via the bridge).
  const prior = await prisma.template.findMany({ where: { createdById: systemUserId } })
  const existing = prior.find((o) => {
    const src = (o.itinerary as { sourceFile?: string } | null)?.sourceFile
    return !!src && src === itinerary.sourceFile
  })

  // The JSON never carries the single cover (set via the dashboard CoverPicker) —
  // update leaves Template.coverImage untouched. The gallery comes from the JSON
  // when present, else keeps whatever the prior row had.
  const jsonCoverImages = itinerary.overview.cover_images ?? []
  const priorCoverImages = existing && Array.isArray(existing.coverImages) ? existing.coverImages : []
  const coverImages = jsonCoverImages.length ? jsonCoverImages : priorCoverImages

  const data = {
    title: itinerary.title,
    // Cover card uses Template.description → the tagline (full text lives in the itinerary jsonb).
    description: itinerary.overview.cover_tagline ?? itinerary.overview.description?.split('\n')[0] ?? null,
    totalDays: itinerary.totalDays,
    season: itinerary.season ?? null,
    coverImages,
    itinerary: itinerary as unknown as Prisma.InputJsonValue,
    availability: availability as unknown as Prisma.InputJsonValue,
    published: PUBLISH, // --publish → shows on /discover (no login); else draft
  }

  const template = existing
    ? await prisma.template.update({ where: { id: existing.id }, data })
    : await prisma.template.create({ data: { ...data, createdById: systemUserId } })

  // Keeps the existing shareCode when there is one (and re-creates the bridge
  // Trip if it's missing); only mints fresh on a first-time import.
  const code = await generateShareCodeForTemplate(template.id, systemUserId, PREFIX)
  // Push the new content into the system-owned bridge Trip so /activate + LIFF
  // serve the updated itinerary (delete-recreate used to get this for free).
  const bridged = await syncBridgeTrip(template.id)

  const acts = itinerary.days.reduce((n, d) => n + d.activities.length, 0)
  console.log(`${existing ? 'Updated' : 'Imported'} "${itinerary.title}"${bridged ? ' (bridge trip synced)' : ''}`)
  console.log(`  → ${code} · ${itinerary.totalDays} days · ${acts} activities · airports ${JSON.stringify(itinerary.airports)}`)
  console.log(`  availability: ${JSON.stringify(availability)}`)
  console.log(PUBLISH
    ? `  PUBLISHED — open /discover (no login needed) to view.`
    : `  draft (published:false) — open Admin → Dashboard → Plan to view/publish.`)
}

main()
  .catch((e) => { console.error('Import failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
