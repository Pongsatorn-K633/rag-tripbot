import { prisma } from '../db'
import { embedText } from './embedder'

export interface RetrievalParams {
  month: string
  duration: number
  vibe?: string[]
  season: string
}

export interface ItineraryBlock {
  id: number
  content: string
  type: 'core' | 'extension' | 'day_trip'
  duration: number
  start_loc: string
  end_loc: string
  season: string[]
  tags: string[]
  similarity: number
}

export async function retrieveBlocks(params: RetrievalParams): Promise<ItineraryBlock[]> {
  const queryEmbedding = await embedText(
    `${params.duration}-day trip to Japan in ${params.month}. Vibe: ${params.vibe?.join(', ')}`
  )
  const vectorStr = `[${queryEmbedding.join(',')}]`

  // Step 1: Find best core block
  const coreBlocks = await prisma.$queryRaw<ItineraryBlock[]>`
    SELECT id, content, type, duration, start_loc, end_loc, season, tags,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM itinerary_blocks
    WHERE type = 'core'
      AND ${params.season} = ANY(season)
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT 3
  `

  if (coreBlocks.length === 0) throw new Error('No core blocks found for this query')

  const bestCore = coreBlocks[0]
  const remainder = params.duration - bestCore.duration
  const results: ItineraryBlock[] = [bestCore]

  // Step 2: Fill remainder with extension blocks chained from the core's end location
  if (remainder > 0) {
    const extensions = await prisma.$queryRaw<ItineraryBlock[]>`
      SELECT id, content, type, duration, start_loc, end_loc, season, tags,
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM itinerary_blocks
      WHERE type = 'extension'
        AND ${params.season} = ANY(season)
        AND start_loc = ${bestCore.end_loc}
        AND duration <= ${remainder}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT 5
    `
    // Greedy fill: pick extensions until remainder is satisfied
    let remaining = remainder
    for (const ext of extensions) {
      if (ext.duration <= remaining) {
        results.push(ext)
        remaining -= ext.duration
      }
      if (remaining === 0) break
    }
  }

  return results
}
