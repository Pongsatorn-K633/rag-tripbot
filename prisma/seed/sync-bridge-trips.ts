/**
 * Maintenance: re-sync every template's system-owned bridge Trip to the
 * template's current itinerary/title/cover.
 *
 * Bridge trips are created once when a template is first minted; if the
 * template's itinerary is later edited, the bridge can drift (the LINE bot +
 * LIFF itinerary view read the bridge by shareCode, so they'd show stale
 * content). The admin PATCH route now auto-syncs on edit — this script fixes
 * any pre-existing drift.
 *
 * Run with: npx tsx prisma/seed/sync-bridge-trips.ts
 */
import 'dotenv/config'
import { prisma } from '../../lib/db/index.js'
import { syncBridgeTrip } from '../../lib/share-code.js'

async function main() {
  const templates = await prisma.template.findMany({
    where: { shareCode: { not: null } },
    select: { id: true, title: true, shareCode: true },
  })

  for (const t of templates) {
    const updated = await syncBridgeTrip(t.id)
    console.log(`${updated ? 'synced ' : 'no bridge'} ${t.shareCode} | ${t.title}`)
  }
  console.log(`\nDone — checked ${templates.length} template(s).`)
}

main()
  .catch((e) => { console.error('Sync failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
