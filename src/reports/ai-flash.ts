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

const AD_KEYWORDS = ['ucloud', '6.9元购']

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

  const lines = text.split('\n')
  let startIdx = -1
  let endIdx = lines.length

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^## \*\*今日摘要\*\*$/)) {
      startIdx = i + 1
    }
    if (lines[i].match(/^## \*\*AI资讯日报多渠道\*\*$/)) {
      endIdx = i
      break
    }
  }

  if (startIdx < 0) return null

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

function extractJuyaItem(itemHtml: string): { title: string; url: string; summary: string; links: string[] } | null {
  const h2Match = /<h2><a href="([^"]+)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/.exec(itemHtml)
  if (!h2Match) return null
  const mainUrl = h2Match[1]
  const title = h2Match[2].trim()

  const bqMatch = /<blockquote><p>([\s\S]*?)<\/p><\/blockquote>/.exec(itemHtml)
  const summary = bqMatch
    ? bqMatch[1].replace(/<[^>]+>/g, '').trim()
    : (itemHtml.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '').replace(/<[^>]+>/g, '').trim()

  const linkMatches = [...itemHtml.matchAll(/<li><a href="([^"]+)">(.*?)<\/a><\/li>/g)]
  const links = linkMatches.map(m => m[1]).filter(u => u !== mainUrl)

  return { title, url: mainUrl, summary, links }
}

async function fetchJuyaDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<Array<{ title: string; url: string; summary: string; sourceName: string }> | null> {
  const resp = await fetcher('https://imjuya.github.io/juya-ai-daily/rss.xml')
  if (!resp.ok) return null
  const xml = await resp.text()

  // Parse RSS items from XML (simple regex-based for bun compat)
  // Extract items where pubDate matches today (Beijing)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/
  const contentRegex = /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/

  // Compute Beijing date string (same correct approach as fetchHexiDaily)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`
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

  // 替代 cleanHtmlContent 全量处理，对每个 item 单独解析
  const flashItems: Array<{ title: string; url: string; summary: string; sourceName: string }> = []
  for (const item of todayItems) {
    const parsed = extractJuyaItem(item.content)
    if (parsed) {
      flashItems.push({
        title: parsed.title,
        url: parsed.url,
        summary: parsed.summary,
        sourceName: '橘鸦AI早报',
      })
    }
  }
  if (flashItems.length === 0) return null
  return flashItems
}

async function fetchClawfeedDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  const resp = await fetcher('https://clawfeed.kevinhe.io/feed/kevin')
  if (!resp.ok) return null
  const json = await resp.json() as { digests: Array<{ created_at: string; content: string }> }
  const items = json.digests ?? []

  // Compute Beijing date string (same correct approach as fetchHexiDaily)
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const todayStr = `${yyyy}-${mm}-${dd}`
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
