/**
 * Import a transformer plan JSON into a draft pre-planned Template (V3 itinerary).
 * Idempotent: replaces any prior import with the same title. Saves as a DRAFT
 * (published:false) so it shows in Admin → Dashboard → Pre-planned, not to the public.
 *
 *   npx tsx scripts/import-dopamichi.ts [path/to/plan.json]
 */
import './load-env.js' // .env.local (dev branch) wins over .env — never import to prod by accident
import { readFileSync } from 'fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/db/index.js'
import { generateShareCodeForTemplate, getSystemUserId } from '../lib/share-code.js'
import { importPlanJson, deriveAvailability } from '../lib/trips/import-plan.js'

const args = process.argv.slice(2)
const PUBLISH = args.includes('--publish') // publish so it shows on /pre-planned (no login)
const SRC = args.find((a) => !a.startsWith('--')) ?? 'docs/pre-planned-trip/Dopamichi-update.json'
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

  // Replace any prior import of THIS source file (+ bridge trips). Matching on the
  // stable sourceFile (not title) keeps re-import idempotent even if you edit the title.
  // Capture the prior row's cover so a re-import doesn't wipe a cover set in the
  // dashboard (it lives in DB columns, not the JSON — so we carry it forward).
  let priorCover: string | null = null
  let priorCoverImages: string[] = []
  const prior = await prisma.template.findMany({ where: { createdById: systemUserId } })
  for (const o of prior) {
    const src = (o.itinerary as { sourceFile?: string } | null)?.sourceFile
    if (src && src === itinerary.sourceFile) {
      priorCover = o.coverImage ?? priorCover
      if (Array.isArray(o.coverImages) && o.coverImages.length) priorCoverImages = o.coverImages
      await prisma.trip.deleteMany({ where: { templateId: o.id } })
      await prisma.template.delete({ where: { id: o.id } })
    }
  }

  // The JSON never carries the single cover (set via the dashboard CoverPicker), so it
  // always inherits from the prior row. The gallery comes from the JSON when present,
  // else falls back to whatever the prior row had.
  const jsonCoverImages = itinerary.overview.cover_images ?? []
  const coverImages = jsonCoverImages.length ? jsonCoverImages : priorCoverImages

  const template = await prisma.template.create({
    data: {
      title: itinerary.title,
      // Cover card uses Template.description → the tagline (full text lives in the itinerary jsonb).
      description: itinerary.overview.cover_tagline ?? itinerary.overview.description?.split('\n')[0] ?? null,
      totalDays: itinerary.totalDays,
      season: itinerary.season ?? null,
      coverImage: priorCover, // preserved from the prior import (dashboard-set; not in JSON)
      coverImages,
      itinerary: itinerary as unknown as Prisma.InputJsonValue,
      availability: availability as unknown as Prisma.InputJsonValue,
      published: PUBLISH, // --publish → shows on /pre-planned (no login); else draft
      createdById: systemUserId,
    },
  })
  const code = await generateShareCodeForTemplate(template.id, systemUserId, PREFIX)

  const acts = itinerary.days.reduce((n, d) => n + d.activities.length, 0)
  console.log(`Imported "${itinerary.title}"`)
  console.log(`  → ${code} · ${itinerary.totalDays} days · ${acts} activities · airports ${JSON.stringify(itinerary.airports)}`)
  console.log(`  availability: ${JSON.stringify(availability)}`)
  console.log(PUBLISH
    ? `  PUBLISHED — open /pre-planned (no login needed) to view.`
    : `  draft (published:false) — open Admin → Dashboard → Pre-planned to view/publish.`)
}

main()
  .catch((e) => { console.error('Import failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
