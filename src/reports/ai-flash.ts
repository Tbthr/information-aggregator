import { beijingDayRange, formatBeijingDate } from '../../lib/date-utils.js'
import type { AiClient } from '../ai/types.js'

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

export interface AiFlashItem {
  title: string
  url: string
  summary: string
  sourceName: string
  /** Preserves original markdown for ClawFeed items */
  originalMarkdown?: string
}

export type AiFlashCategoryName = '产品更新' | '前沿研究' | '行业动态' | '开源项目' | '社媒精选' | '其他'

export interface AiFlashCategory {
  name: AiFlashCategoryName
  items: AiFlashItem[]
}

const AD_KEYWORDS = ['ucloud', '6.9元购']

async function fetchHexiDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  // Use Beijing time to construct URL (hexi publishes by Beijing date)
  const dateStr = formatBeijingDate(new Date())
  const monthStr = dateStr.slice(0, 7)

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

function parseHexiMarkdownToItems(content: string): AiFlashItem[] {
  const lines = content.split('\n')
  const items: AiFlashItem[] = []
  let currentCategory = ''

  for (const line of lines) {
    // 检测分类标题，如 "### 产品与功能更新"
    const categoryMatch = line.match(/^###\s+(.+)/)
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim()
      continue
    }

    // 检测条目：如 "1.   **Gemini深度嵌入安卓底层.**" 或 "• ..."
    const itemMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*[\s:.。](.+)/) ||
                      line.match(/^[•\-]\s+(.+)/)
    if (itemMatch && currentCategory) {
      const title = itemMatch[1].trim()
      const summary = itemMatch[2]?.trim() ?? ''
      const urlMatch = title.match(/\[([^\]]+)\]\(([^)]+)\)/)
      items.push({
        title: urlMatch ? urlMatch[1] : title,
        url: urlMatch ? urlMatch[2] : '',
        summary: summary.slice(0, 200),
        sourceName: '何夕2077',
      })
    }
  }

  return items
}

function parseClawfeedMarkdownToItems(content: string): AiFlashItem[] {
  const items: AiFlashItem[] = []
  // Clawfeed content is already markdown with items separated by blank lines
  // Try to extract items from lines starting with - or *
  const lines = content.split('\n')
  let currentItem: Partial<AiFlashItem> = {}
  let currentMarkdownLines: string[] = []

  const pushCurrentItem = () => {
    if (currentItem.title) {
      items.push({
        title: currentItem.title,
        url: currentItem.url ?? '',
        summary: currentItem.summary?.slice(0, 200) ?? '',
        sourceName: 'ClawFeed',
        originalMarkdown: currentMarkdownLines.join('\n'),
      })
    }
    currentItem = {}
    currentMarkdownLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      // Blank line - end of current item
      pushCurrentItem()
      continue
    }

    // Check for item start: - **Title** or - [Title](url)
    const itemMatch = trimmed.match(/^[•\-]\s+(.+)/)
    if (itemMatch) {
      // Start of new item - push previous if exists
      pushCurrentItem()

      const rest = itemMatch[1].trim()
      const urlMatch = rest.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (urlMatch) {
        currentItem = {
          title: urlMatch[1],
          url: urlMatch[2],
          summary: rest.replace(/\[([^\]]+)\]\([^)]+\)/, '').trim(),
        }
      } else {
        currentItem = {
          title: rest.replace(/^\*\*(.+)\*\*.*/, '$1'),
          url: '',
          summary: rest.replace(/^\*\*(.+)\*\*[\s:.。]*/, '').trim(),
        }
      }
      currentMarkdownLines = [line]
    } else if (currentItem.title) {
      // Continuation line of current item
      currentItem.summary = (currentItem.summary ?? '') + ' ' + trimmed
      currentMarkdownLines.push(line)
    }
  }

  // Push last item if exists
  pushCurrentItem()

  return items
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

async function fetchJuyaDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashItem[] | null> {
  const resp = await fetcher('https://imjuya.github.io/juya-ai-daily/rss.xml')
  if (!resp.ok) return null
  const xml = await resp.text()

  // Parse RSS items from XML (simple regex-based for bun compat)
  // Extract items where pubDate matches today (Beijing)
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/
  const contentRegex = /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/

  // Compute Beijing date string
  const todayStr = formatBeijingDate(new Date())
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
  const flashItems: AiFlashItem[] = []
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

  // Compute Beijing date string
  const todayStr = formatBeijingDate(new Date())
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

export async function categorizeAiFlash(
  items: AiFlashItem[],
  aiClient: AiClient,
  options?: { maxCategories?: number }
): Promise<AiFlashCategory[]> {
  if (items.length === 0) return []

  const { maxCategories = 6 } = options ?? {}

  const systemPrompt = `你是一个内容分类助手。将输入的 AI 快讯条目分类到以下六个类别之一：产品更新 / 前沿研究 / 行业动态 / 开源项目 / 社媒精选 / 其他。不要改写任何内容，只输出 JSON。类别数量不超过 ${maxCategories} 个。"其他"作为最后兜底。`

  const userPrompt = `请将以下条目分类，输出 JSON 格式：{ "categories": [{ "name": "分类名", "items": [{ "title": "...", "url": "...", "summary": "...", "sourceName": "..." }] }, ...] }。每个条目必须归属一个类别。

条目：
${items.map((item, i) => `${i + 1}. [${item.title}](${item.url}) — ${item.summary}（来源：${item.sourceName}）`).join('\n')}

输出（只输出 JSON，不要其他内容）：`

  try {
    const response = await aiClient.complete({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 4096,
    })

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallbackCategorize(items)

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.categories ?? fallbackCategorize(items)
  } catch {
    return fallbackCategorize(items)
  }
}

function fallbackCategorize(items: AiFlashItem[]): AiFlashCategory[] {
  return [{ name: '其他', items }]
}

export async function fetchAiFlashSources(
  sources: AiFlashSource[],
  options: { fetchImpl?: typeof fetch } = {}
): Promise<AiFlashItem[]> {
  const fetcher = options.fetchImpl ?? fetch
  const results: AiFlashItem[] = []

  await Promise.allSettled(
    sources.filter(s => s.enabled).map(async (source) => {
      try {
        if (source.adapter === 'hexi-daily') {
          const content = await fetchHexiDaily(source, fetcher)
          if (content) {
            const items = parseHexiMarkdownToItems(content.content)
            results.push(...items)
          }
        } else if (source.adapter === 'juya-daily') {
          const items = await fetchJuyaDaily(source, fetcher)
          if (items) {
            results.push(...items)
          }
        } else if (source.adapter === 'clawfeed-daily') {
          const content = await fetchClawfeedDaily(source, fetcher)
          if (content) {
            const items = parseClawfeedMarkdownToItems(content.content)
            results.push(...items)
          }
        }
      } catch {
        // fail-silent: skip single source failure
      }
    })
  )

  return results
}
