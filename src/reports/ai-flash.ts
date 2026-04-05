import { beijingDayRange } from '../../lib/date-utils.js'

export interface AiFlashSource {
  id: string
  adapter: 'hexi-daily' | 'juya-daily' | 'clawfeed-daily'
  enabled: boolean
}

export interface AiFlashContent {
  sourceId: string
  sourceName: string
  publishedAt: string  // UTC ISO 8601
  content: string      // cleaned Markdown
}

async function fetchHexiDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  // Use Beijing time to construct URL (hexi publishes by Beijing date)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const dateStr = `${yyyy}-${mm}-${dd}`
  const monthStr = `${yyyy}-${mm}`

  const url = `https://r.jina.ai/https://ai.hubtoday.app/${monthStr}/${dateStr}/`
  const resp = await fetcher(url)
  if (!resp.ok) return null
  const text = await resp.text()

  // r.jina.ai returns 200 even when target is 404 - detect error content
  if (/<title>Error<\/title>/i.test(text) || (text.includes('Warning:') && text.includes('error'))) {
    return null
  }

  // Find start: first "# AI资讯日报" heading
  const lines = text.split('\n')
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^#\s+AI资讯日报/)) {
      startIdx = i + 1
      break
    }
  }
  if (startIdx < 0) startIdx = 0

  // Find end: "© 2026 何夕2077"
  let endIdx = lines.length
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].includes('© 2026 何夕2077')) {
      endIdx = i
      break
    }
  }

  // Filter ad lines and rejoin
  const AD_KEYWORDS = ['ucloud', '6.9元购']

  const contentLines = lines.slice(startIdx, endIdx).filter(line => {
    return !AD_KEYWORDS.some(keyword => line.includes(keyword))
  })

  return {
    sourceId: source.id,
    sourceName: '何夕2077 AI资讯',
    publishedAt: new Date().toISOString(),
    content: contentLines.join('\n').trim(),
  }
}

function parseBeijingDate(pubDateStr: string): Date {
  // pubDate format: "Mon, 05 Apr 2026 12:00:00 GMT"
  const date = new Date(pubDateStr)
  // Convert to Beijing time by adding 8 hours
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
}

function cleanHtmlContent(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2($1)')
    .replace(/<[^>]+>/g, '')
    .trim()
}

async function fetchJuyaDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  const resp = await fetcher('https://imjuya.github.io/juya-ai-daily/rss.xml')
  if (!resp.ok) return null
  const xml = await resp.text()

  // Parse RSS items from XML (simple regex-based for bun compat)
  // Extract items where pubDate matches today (Beijing)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/
  const contentRegex = /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/

  const todayStr = new Date().toISOString().split('T')[0]
  const { start, end } = beijingDayRange(todayStr)
  const matches = [...xml.matchAll(itemRegex)]
  const items: { pubDate: string; content: string }[] = matches.map(match => {
    const itemXml = match[1]
    const pubDateMatch = pubDateRegex.exec(itemXml)
    const contentMatch = contentRegex.exec(itemXml)
    if (pubDateMatch && contentMatch) {
      return { pubDate: pubDateMatch[1], content: contentMatch[1] }
    }
    return null
  }).filter((item): item is { pubDate: string; content: string } => item !== null)

  // Filter today's items by Beijing time range
  const todayItems = items.filter(item => {
    const itemDate = parseBeijingDate(item.pubDate)
    return itemDate >= start && itemDate <= end
  })

  if (todayItems.length === 0) return null

  // Clean HTML: strip tags, keep links and bold
  const cleanedContent = todayItems.map(item => cleanHtmlContent(item.content)).join('\n\n')

  return {
    sourceId: source.id,
    sourceName: '橘鸦AI早报',
    publishedAt: new Date().toISOString(),
    content: cleanedContent,
  }
}

async function fetchClawfeedDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  const resp = await fetcher('https://clawfeed.kevinhe.io/feed/kevin')
  if (!resp.ok) return null
  const json = await resp.json() as { digests: Array<{ created_at: string; content: string }> }
  const items = json.digests ?? []

  const todayStr = new Date().toISOString().split('T')[0]
  const { start, end } = beijingDayRange(todayStr)
  const todayItems = items.filter(item => {
    const itemDate = new Date(item.created_at)
    return itemDate >= start && itemDate <= end
  })

  if (todayItems.length === 0) return null

  // Already Markdown, filter excessive blank lines
  const content = todayItems
    .map(item => item.content)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    sourceId: source.id,
    sourceName: 'ClawFeed',
    publishedAt: new Date().toISOString(),
    content,
  }
}

export async function fetchAiFlashSources(
  sources: AiFlashSource[],
  options: { fetchImpl?: typeof fetch } = {}
): Promise<AiFlashContent[]> {
  const fetcher = options.fetchImpl ?? fetch
  const results: AiFlashContent[] = []

  await Promise.allSettled(
    sources.filter(s => s.enabled).map(async (source) => {
      try {
        let content: AiFlashContent | null = null
        if (source.adapter === 'hexi-daily') {
          content = await fetchHexiDaily(source, fetcher)
        } else if (source.adapter === 'juya-daily') {
          content = await fetchJuyaDaily(source, fetcher)
        } else if (source.adapter === 'clawfeed-daily') {
          content = await fetchClawfeedDaily(source, fetcher)
        }
        if (content) results.push(content)
      } catch {
        // fail-silent: skip single source failure
      }
    })
  )

  return results
}
