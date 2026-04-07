import { generateText } from '../llm/client'

export interface ExtractedParams {
  month: string
  duration: number
  vibe: string[]
  season: 'Winter' | 'Spring' | 'Summer' | 'Autumn'
  warning?: string
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

  const raw = await generateText(prompt, { maxOutputTokens: 4096 })
  const clean = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  const season = MONTH_TO_SEASON[parsed.month] ?? 'Winter'
  const warning = parsed.duration > 15
    ? 'Thai citizens require a visa for Japan stays over 15 days.'
    : undefined

  return { ...parsed, season, warning }
}
