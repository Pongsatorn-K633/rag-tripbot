/**
 * Remove the imported Dopamichi V3 draft (+ its bridge trips) from the DB.
 * Use to unbreak production when it's running pre-V3 code that can't render V3.
 *
 *   npx tsx scripts/remove-dopamichi.ts
 */
import './load-env.js' // .env.local (dev branch) wins over .env
import { prisma } from '../lib/db/index.js'

const TITLE_CONTAINS = 'Matsumoto'

async function main() {
  const tpls = await prisma.template.findMany({ where: { title: { contains: TITLE_CONTAINS } } })
  if (tpls.length === 0) { console.log('Nothing to remove.'); return }
  for (const o of tpls) {
    const trips = await prisma.trip.deleteMany({ where: { templateId: o.id } })
    await prisma.template.delete({ where: { id: o.id } })
    console.log(`Removed template "${o.title}" (${o.id}) + ${trips.count} bridge trip(s)`)
  }
}

main()
  .catch((e) => { console.error('Removal failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
