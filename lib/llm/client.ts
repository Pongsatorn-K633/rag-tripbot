import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
const TIMEOUT_MS = 60_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out')), ms)
    ),
  ])
}

export async function generateText(prompt: string): Promise<string> {
  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
    TIMEOUT_MS,
  )
  return response.text ?? ''
}

export async function generateFromVision(prompt: string, imageBase64: string): Promise<string> {
  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          ],
        },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
    TIMEOUT_MS,
  )
  return response.text ?? ''
}
