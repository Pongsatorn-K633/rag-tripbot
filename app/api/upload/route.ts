import { NextRequest, NextResponse } from 'next/server'
import { generateFromOllama, generateFromVision } from '@/lib/llm/client'

// ── Itinerary JSON contract shape ──────────────────────────────────────────
// Must match the project-wide contract defined in CLAUDE.md.
// { title, totalDays, season, days[{ day, location, activities, accommodation, transport }], shareCode }

const EXTRACTION_PROMPT_TEMPLATE = (content: string) => `\
You are an itinerary extraction assistant for Japan travel planning.
Extract or generate a structured Japan travel itinerary from the content below.

Return ONLY valid JSON matching this exact structure — no explanation, no markdown fences:
{
  "title": "Trip title in English or Thai",
  "totalDays": <number>,
  "season": "Winter" | "Spring" | "Summer" | "Autumn",
  "days": [
    {
      "day": <number>,
      "location": "City name",
      "activities": [
        { "time": "HH:MM", "name": "Activity name", "notes": "Optional detail" }
      ],
      "accommodation": "Hotel or accommodation name",
      "transport": "How to travel this day"
    }
  ],
  "shareCode": null
}

Rules:
- "season" must be exactly one of: Winter, Spring, Summer, Autumn
- "totalDays" must equal the number of items in "days"
- Every day must have at least one activity
- All string values should be informative and non-empty
- If the content is not travel-related or unreadable, create a reasonable 5-day Tokyo itinerary as a starting placeholder

Content to extract from:
${content.slice(0, 3000)}

Output JSON only:`

export async function POST(req: NextRequest) {
  let file: File | null = null

  try {
    const formData = await req.formData()
    file = formData.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const isImage = /\.(png|jpe?g|webp)$/i.test(file.name) ||
    file.type.startsWith('image/')

  let raw: string

  try {
    if (isImage) {
      // Use Qwen2.5-VL to extract itinerary directly from the image
      const imageBase64 = buffer.toString('base64')
      raw = await generateFromVision(EXTRACTION_PROMPT_TEMPLATE('Extract the itinerary from this image.'), imageBase64)
    } else {
      // PDF or text: extract UTF-8 text and send to Typhoon2
      let textContent = ''
      try {
        textContent = buffer.toString('utf-8')
      } catch {
        textContent = `[Could not read file: ${file.name}]`
      }
      raw = await generateFromOllama(EXTRACTION_PROMPT_TEMPLATE(textContent))
    }
  } catch (err) {
    console.error('[/api/upload] LLM call error:', err)
    return NextResponse.json(
      { error: 'Failed to process file. Make sure Ollama is running with the required models.' },
      { status: 500 },
    )
  }

  try {

    // Strip any accidental markdown fences the model might add
    const clean = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    // Parse and do a minimal shape validation before returning
    const itinerary = JSON.parse(clean)

    if (!itinerary.days || !Array.isArray(itinerary.days)) {
      throw new Error('Extracted JSON missing required "days" array')
    }

    return NextResponse.json({ itinerary })
  } catch (err) {
    console.error('[/api/upload] JSON parse error:', err)
    return NextResponse.json(
      { error: 'Failed to extract itinerary from file. Please try a different file.' },
      { status: 500 },
    )
  }
}
