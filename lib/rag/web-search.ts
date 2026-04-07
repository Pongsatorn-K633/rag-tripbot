import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

const TIMEOUT_MS = 60_000

export interface WebSearchResult {
  title: string
  url: string
  content: string
}

// Used by assembler.ts for web chat RAG pipeline
export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  if (!GEMINI_API_KEY) return []

  try {
    const text = await generateWithSearch(`Search the web and provide a detailed answer for: ${query}`)
    if (text) {
      return [{ title: 'Google Search', url: '', content: text }]
    }
    return []
  } catch (err) {
    console.error('[web-search] searchWeb failed:', err)
    return []
  }
}

// Used by LINE bot injector — single call with persona + Google Search grounding
export async function generateWithSearch(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) return ''

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Search request timed out')), TIMEOUT_MS)
      ),
    ])
    return response.text ?? ''
  } catch (err) {
    console.error('[web-search] Gemini grounded search failed:', err)
    return ''
  }
}
