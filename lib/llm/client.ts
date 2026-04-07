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

export interface LlmOpts {
  maxOutputTokens?: number
  disableThinking?: boolean
  /**
   * Optional JSON Schema. When provided, Gemini constrains its output to
   * conform to the schema (structured output mode). Use this for extraction
   * tasks where the output shape is fixed and known in advance.
   */
  responseSchema?: unknown
}

function buildConfig(opts: LlmOpts, defaults: { maxOutputTokens: number }) {
  const config: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: opts.maxOutputTokens ?? defaults.maxOutputTokens,
  }
  if (opts.disableThinking) config.thinkingConfig = { thinkingBudget: 0 }
  if (opts.responseSchema) {
    config.responseMimeType = 'application/json'
    config.responseSchema = opts.responseSchema
  }
  return config
}

export async function generateText(prompt: string, opts: LlmOpts = {}): Promise<string> {
  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: buildConfig(opts, { maxOutputTokens: 2048 }),
    }),
    TIMEOUT_MS,
  )
  return response.text ?? ''
}

export async function generateFromVision(prompt: string, imageBase64: string): Promise<string> {
  return generateFromFile(prompt, imageBase64, 'image/jpeg')
}

/**
 * Send an arbitrary file (image or PDF) to Gemini as inline data.
 * Gemini 2.5 Flash natively understands PDFs (no pre-OCR step needed).
 */
export async function generateFromFile(
  prompt: string,
  fileBase64: string,
  mimeType: string,
  opts: LlmOpts = { disableThinking: true },
): Promise<string> {
  const response = await withTimeout(
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: fileBase64 } },
          ],
        },
      ],
      config: buildConfig(
        // Default thinking off for file extraction unless caller overrides
        { disableThinking: true, ...opts },
        { maxOutputTokens: 8192 },
      ),
    }),
    TIMEOUT_MS,
  )
  return response.text ?? ''
}
