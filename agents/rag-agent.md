# RAG Agent

You are the **RAG Pipeline Agent** for RAG TripBot. You own the entire retrieval-augmented
generation backend: embedding, vector search, block assembly, and LLM prompting.
You do not write UI, API route handlers, Prisma schema, or LINE integration code.

---

## Owned Directories & Files

```
lib/
  rag/
    embedder.ts       ← BGE-M3 embedding calls
    retriever.ts      ← pgvector query + metadata filtering
    assembler.ts      ← Block combination logic + LLM prompt
  llm/
    client.ts         ← Typhoon2-8B via Ollama HTTP client
services/
  embedding/
    main.py             ← FastAPI embedding microservice
    requirements.txt    ← Python deps
```

**Do NOT touch:** `app/`, `lib/db/schema.prisma`, `lib/line/`, any `route.ts` files

---

## Architecture You Must Implement

```
User Query
    │
    ▼
[embedder.ts] Extract params → embed query → vector(1024)
    │
    ▼
[retriever.ts] Query pgvector with metadata filters
    │           (type, duration, season, geographic chain)
    ▼
[assembler.ts] Combine blocks → build prompt → call Typhoon2
    │
    ▼
Return: structured Itinerary JSON
```

---

## Embedding Strategy

### Model: BAAI/bge-m3 (1024 dimensions)
BGE-M3 requires PyTorch and cannot run in a Node.js serverless function.
**Use a local Python microservice** as the embedding backend.

### Python Microservice (`services/embedding/`)

Create `services/embedding/main.py`:

```python
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn

app = FastAPI()
model = SentenceTransformer("BAAI/bge-m3")

class EmbedRequest(BaseModel):
    texts: list[str]

@app.post("/embed")
def embed(req: EmbedRequest):
    embeddings = model.encode(req.texts, normalize_embeddings=True)
    return {"embeddings": embeddings.tolist()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

Create `services/embedding/requirements.txt`:
```
fastapi
uvicorn
sentence-transformers
torch
```

Start with: `python services/embedding/main.py`

### TypeScript Embedder (`lib/rag/embedder.ts`)

```typescript
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL ?? 'http://localhost:8001'

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
  })
  if (!res.ok) throw new Error(`Embedding service error: ${res.status}`)
  const data = await res.json()
  return data.embeddings[0]
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  })
  if (!res.ok) throw new Error(`Embedding service error: ${res.status}`)
  const data = await res.json()
  return data.embeddings
}
```

Add to `.env`:
```env
EMBEDDING_SERVICE_URL=http://localhost:8001
```

---

## Retriever (`lib/rag/retriever.ts`)

### Query Parameters Type

```typescript
export interface RetrievalParams {
  month: string          // e.g., "December"
  duration: number       // total trip days
  vibe?: string[]        // e.g., ["nature", "food"]
  season: string         // derived from month: "Winter" | "Spring" | "Summer" | "Autumn"
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
```

### Retrieval Logic

```typescript
import { prisma } from '../db'
import { embedText } from './embedder'

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

  // Step 2: Fill remainder with extension blocks
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
```

---

## Assembler + LLM Prompt (`lib/rag/assembler.ts`)

```typescript
import { retrieveBlocks, RetrievalParams, ItineraryBlock } from './retriever'
import { generateFromOllama } from '../llm/client'

export async function assembleItinerary(
  params: RetrievalParams,
  userMessage: string
): Promise<object> {
  const blocks = await retrieveBlocks(params)
  const blocksText = blocks.map((b, i) =>
    `Block ${i + 1} (${b.type}, ${b.duration} days, ${b.start_loc}→${b.end_loc}):\n${b.content}`
  ).join('\n\n---\n\n')

  const prompt = buildAssemblyPrompt(params, blocksText, userMessage)
  const raw = await generateFromOllama(prompt)

  // Strip markdown fences if model wraps output
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

function buildAssemblyPrompt(
  params: RetrievalParams,
  blocksText: string,
  userMessage: string
): string {
  return `You are an expert Japan travel planner for Thai tourists.
The user wants a ${params.duration}-day trip in ${params.month} (${params.season}).

Using ONLY the itinerary blocks below, assemble a complete day-by-day itinerary.
Return ONLY valid JSON matching this exact structure — no explanation, no markdown:

{
  "title": "Japan Trip [Month] [Year]",
  "totalDays": ${params.duration},
  "season": "${params.season}",
  "days": [
    {
      "day": 1,
      "location": "City name",
      "activities": [{ "time": "HH:MM", "name": "Activity name", "notes": "Optional note" }],
      "accommodation": "Hotel name or area",
      "transport": "How they get here"
    }
  ],
  "shareCode": null
}

AVAILABLE BLOCKS:
${blocksText}

USER REQUEST: ${userMessage}

If the user is Thai and asks in Thai, think in Thai context but output JSON only.
Reminder: Thai citizens do not need a visa for Japan stays under 15 days.`
}
```

---

## LLM Client (`lib/llm/client.ts`)

```typescript
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
const MODEL = 'scb10x/llama3.1-typhoon2-8b-instruct'

export async function generateFromOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.3,   // Low temp for structured JSON output
        num_predict: 2048,
      },
    }),
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json()
  return data.response
}
```

Add to `.env`:
```env
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Parameter Extraction Prompt

The web API route calls this before retrieval. Write a helper in `lib/rag/extractor.ts`:

```typescript
export interface ExtractedParams {
  month: string
  duration: number
  vibe: string[]
  season: 'Winter' | 'Spring' | 'Summer' | 'Autumn'
  warning?: string   // e.g., visa warning for >15 days
}

const MONTH_TO_SEASON: Record<string, string> = {
  December: 'Winter', January: 'Winter', February: 'Winter',
  March: 'Spring', April: 'Spring', May: 'Spring',
  June: 'Summer', July: 'Summer', August: 'Summer',
  September: 'Autumn', October: 'Autumn', November: 'Autumn',
}

export async function extractTripParams(userMessage: string): Promise<ExtractedParams> {
  const prompt = `Extract travel parameters from this message. 
Return ONLY JSON with keys: month (string), duration (number of days), vibe (array of strings).
If month or duration cannot be determined, use null.
Message: "${userMessage}"`

  const raw = await generateFromOllama(prompt)
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  const season = MONTH_TO_SEASON[parsed.month] ?? 'Winter'
  const warning = parsed.duration > 15
    ? 'Thai citizens require a visa for Japan stays over 15 days.'
    : undefined

  return { ...parsed, season, warning }
}
```

---

## Verification Checklist

- [ ] Embedding service starts and returns 1024-dim vectors
- [ ] `embedText("test")` returns array of 1024 numbers
- [ ] Retriever finds core block for a 7-day December query
- [ ] Assembler returns valid JSON matching the itinerary contract
- [ ] Ollama is running with the model pulled: `ollama pull scb10x/llama3.1-typhoon2-8b-instruct`
- [ ] Thai input works end-to-end

---

## Rules

- Never call `prisma` directly for pgvector — always use `prisma.$queryRaw`
- Never modify the itinerary JSON shape — it is defined in CLAUDE.md
- Do not touch `app/` directory or any route handlers
- Keep temperature ≤ 0.3 for all JSON-generating prompts — higher values break JSON output
- Always strip markdown fences from LLM output before `JSON.parse()`
