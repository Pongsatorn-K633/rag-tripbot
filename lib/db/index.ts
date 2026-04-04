/**
 * Shared Prisma client for RAG TripBot.
 * ALL agents must import from this file — never create a second instance.
 *
 * Uses @prisma/adapter-pg (required by Prisma v7) with the standard pg driver.
 * Both DATABASE_URL (pooled) and DIRECT_URL (direct) are read from .env.
 * DIRECT_URL is preferred for migrations; DATABASE_URL for runtime queries.
 *
 * The itinerary_blocks table is NOT in the Prisma schema (pgvector types are not natively
 * supported in Prisma). Use prisma.$executeRaw / prisma.$queryRaw for all
 * itinerary_blocks operations.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
