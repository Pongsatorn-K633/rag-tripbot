/**
 * Seed the Category taxonomy from docs/template-structure/dopamichi-categories.json.
 * Idempotent (upsert by `code`) — safe to re-run after editing the JSON.
 *
 *   npx tsx prisma/seed/seed-categories.ts   (or: npm run db:seed-categories)
 *
 * sortOrder is taken from the JSON array order so the admin UI can render the
 * taxonomy in a sensible sequence.
 */
import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../../lib/db/index.js'

interface CategoryRow {
  code: string
  root: string
  category: string
  subCategory: string
  emoji: string
  filterGroup?: string
  destination?: string
  description?: string
}

async function main() {
  const file = join(process.cwd(), 'docs', 'template-structure', 'dopamichi-categories.json')
  const rows = JSON.parse(readFileSync(file, 'utf8')) as CategoryRow[]

  let created = 0
  let updated = 0
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i]
    const data = {
      root: c.root,
      category: c.category,
      subCategory: c.subCategory,
      emoji: c.emoji,
      filterGroup: c.filterGroup || null,
      destination: c.destination || 'generic',
      description: c.description || null,
      sortOrder: i,
    }
    const existing = await prisma.category.findUnique({ where: { code: c.code }, select: { id: true } })
    await prisma.category.upsert({
      where: { code: c.code },
      create: { code: c.code, ...data },
      update: data,
    })
    if (existing) updated++
    else created++
  }

  const [total, jp, generic] = await Promise.all([
    prisma.category.count(),
    prisma.category.count({ where: { destination: 'JP' } }),
    prisma.category.count({ where: { destination: 'generic' } }),
  ])
  console.log(`Categories seeded: ${created} created, ${updated} updated.`)
  console.log(`Total in DB: ${total} (${jp} JP, ${generic} generic)`)
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
