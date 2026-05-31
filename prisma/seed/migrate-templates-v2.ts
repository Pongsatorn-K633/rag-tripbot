/**
 * Phase N5 — migrate existing v1 templates to the v2 node/slot shape.
 *
 *   npx tsx prisma/seed/migrate-templates-v2.ts            # DRY RUN (prints plan)
 *   npx tsx prisma/seed/migrate-templates-v2.ts --apply    # writes changes
 *
 * Idempotent (skips templates already v2). On --apply it also re-syncs each
 * template's LINE/LIFF bridge trip so the bot/LIFF read the v2 itinerary.
 * Reversible in spirit: v1 → v2 is a pure transform (lib/trips/itinerary-model);
 * keep a DB snapshot before --apply if you want a hard rollback.
 */
import 'dotenv/config'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/db/index.js'
import { migrateV1toV2, isV2 } from '../../lib/trips/itinerary-model.js'
import type { AnyItinerary } from '../../lib/itinerary-types.js'
import { syncBridgeTrip } from '../../lib/share-code.js'

const APPLY = process.argv.includes('--apply')

async function main() {
  const templates = await prisma.template.findMany({ orderBy: { createdAt: 'asc' } })
  let migrated = 0
  let already = 0

  for (const t of templates) {
    if (isV2(t.itinerary)) {
      already++
      console.log(`skip   "${t.title}" (${t.shareCode}) — already v2`)
      continue
    }
    const v2 = migrateV1toV2(t.itinerary as unknown as AnyItinerary)
    const meals = v2.days.reduce((n, d) => n + Object.values(d.meals).filter(Boolean).length, 0)
    console.log(`${APPLY ? 'MIGRATE' : 'DRY   '} "${t.title}" (${t.shareCode}) → v2 · ${v2.days.length} days · ${meals} meal slots`)
    if (APPLY) {
      await prisma.template.update({
        where: { id: t.id },
        data: { itinerary: v2 as unknown as Prisma.InputJsonValue },
      })
      await syncBridgeTrip(t.id)
      migrated++
    }
  }

  console.log('')
  if (APPLY) console.log(`Applied — ${migrated} migrated, ${already} already v2.`)
  else console.log(`Dry run — ${templates.length - already} to migrate, ${already} already v2. Re-run with --apply to write.`)
}

main()
  .catch((e) => { console.error('Migration failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
