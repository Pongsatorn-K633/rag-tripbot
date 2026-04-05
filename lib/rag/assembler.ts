import { retrieveBlocks, RetrievalParams, ItineraryBlock } from './retriever'
import { searchWeb } from './web-search'
import { generateFromOllama } from '../llm/client'

export async function assembleItinerary(
  params: RetrievalParams,
  userMessage: string
): Promise<object> {
  // Run pgvector retrieval and web search in parallel
  const [blocks, webResults] = await Promise.all([
    retrieveBlocks(params),
    searchWeb(`Japan ${params.month} ${params.duration}-day trip ${params.vibe?.join(' ') ?? ''} ${userMessage.slice(0, 100)}`),
  ])

  const blocksText = blocks.map((b, i) =>
    `Block ${i + 1} (${b.type}, ${b.duration} days, ${b.start_loc}→${b.end_loc}):\n${b.content}`
  ).join('\n\n---\n\n')

  const webText = webResults.length > 0
    ? webResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`).join('\n\n')
    : ''

  const prompt = buildAssemblyPrompt(params, blocksText, webText, userMessage)
  const raw = await generateFromOllama(prompt)

  // Strip markdown fences if model wraps output
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

function buildAssemblyPrompt(
  params: RetrievalParams,
  blocksText: string,
  webText: string,
  userMessage: string
): string {
  const webSection = webText
    ? `\n\nLATEST WEB INFO (use to enhance activities, add trending spots, or warn about closures):\n${webText}`
    : ''

  return `You are an expert Japan travel planner for Thai tourists.
The user wants a ${params.duration}-day trip in ${params.month} (${params.season}).

Using the itinerary blocks below as the base structure, assemble a complete day-by-day itinerary.
If web search results are provided, use them to enhance the plan with up-to-date info (new attractions, seasonal events, closures, travel tips).
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
${blocksText}${webSection}

USER REQUEST: ${userMessage}

If the user is Thai and asks in Thai, think in Thai context but output JSON only.
Reminder: Thai citizens do not need a visa for Japan stays under 15 days.`
}
