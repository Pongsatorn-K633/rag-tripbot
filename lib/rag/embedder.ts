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
