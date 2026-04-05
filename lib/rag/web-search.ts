const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? ''
const TAVILY_URL = 'https://api.tavily.com/search'

export interface WebSearchResult {
  title: string
  url: string
  content: string
}

export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  if (!TAVILY_API_KEY) return []

  try {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: false,
      }),
    })

    if (!res.ok) {
      console.error(`[web-search] Tavily error: ${res.status}`)
      return []
    }

    const data = await res.json()
    return (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    }))
  } catch (err) {
    console.error('[web-search] Failed:', err)
    return []
  }
}
