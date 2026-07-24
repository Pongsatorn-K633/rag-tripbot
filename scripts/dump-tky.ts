import './load-env.js'
import { writeFileSync } from 'fs'
import { prisma } from '../lib/db/index.js'
async function main() {
  const t = await prisma.template.findFirst({
    where: { shareCode: 'TKY-001' },
    select: { title: true, description: true, coverImage: true, coverImages: true, season: true, totalDays: true, availability: true, itinerary: true, published: true },
  })
  writeFileSync(process.env.DUMP_TO || 'dump.json', JSON.stringify(t, null, 2))
  console.log('dumped to', process.env.DUMP_TO)
}
main().catch((e) => console.error('ERR', e.message)).finally(() => prisma.$disconnect())
