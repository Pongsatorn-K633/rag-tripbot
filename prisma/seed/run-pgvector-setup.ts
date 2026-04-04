/**
 * pgvector setup script.
 * Creates the itinerary_blocks table with HNSW index.
 * This table is managed outside Prisma schema because pgvector types
 * (vector(1024)) are not natively supported by Prisma's schema DSL.
 *
 * Run with: npx tsx prisma/seed/run-pgvector-setup.ts
 */
import 'dotenv/config'
import { prisma } from '../../lib/db/index.js'

async function main() {
  console.log('Enabling pgvector extension...')
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`
  console.log('pgvector extension enabled.')

  console.log('Creating itinerary_blocks table...')
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS itinerary_blocks (
      id          SERIAL PRIMARY KEY,
      content     TEXT NOT NULL,
      embedding   vector(1024),
      type        VARCHAR(20) NOT NULL CHECK (type IN ('core', 'extension', 'day_trip')),
      duration    INT NOT NULL,
      start_loc   VARCHAR(100) NOT NULL,
      end_loc     VARCHAR(100) NOT NULL,
      season      TEXT[] NOT NULL DEFAULT '{}',
      tags        TEXT[] NOT NULL DEFAULT '{}',
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `
  console.log('itinerary_blocks table created.')

  console.log('Creating HNSW index on embedding column...')
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS itinerary_blocks_embedding_idx
      ON itinerary_blocks
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
  `
  console.log('HNSW index created.')
  console.log('pgvector setup complete.')
}

main()
  .catch((e) => {
    console.error('pgvector setup failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
