/**
 * One-off backfill: set sensible default seasonal availability on existing
 * pre-planned templates that don't have any yet. Idempotent — only fills NULLs.
 * Admins can refine these per trip in the dashboard afterwards.
 *
 * Run with: npx tsx prisma/seed/backfill-availability.ts
 */
import 'dotenv/config'
import { prisma } from '../../lib/db/index.js'
import type { TripAvailability } from '../../lib/itinerary-types.js'

const DEFAULTS: Record<string, TripAvailability> = {
  // Snow trip — only viable in winter (great demo of hiding out-of-season).
  'tmpl_hokkaido-snow-adventure': {
    available: [{ from: '12-01', to: '03-15' }],
    recommended: [{ from: '01-10', to: '02-20' }],
  },
  // Kyoto is good year-round; recommend cherry-blossom spring + autumn leaves.
  'tmpl_kyoto-cultural-immersion': {
    available: [],
    recommended: [
      { from: '03-25', to: '04-15' },
      { from: '11-15', to: '12-05' },
    ],
  },
}

async function main() {
  for (const [id, availability] of Object.entries(DEFAULTS)) {
    const t = await prisma.template.findUnique({ where: { id }, select: { id: true, availability: true } })
    if (!t) {
      console.log(`skip (not found): ${id}`)
      continue
    }
    if (t.availability) {
      console.log(`skip (already set): ${id}`)
      continue
    }
    await prisma.template.update({ where: { id }, data: { availability } })
    console.log(`backfilled: ${id}`)
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
