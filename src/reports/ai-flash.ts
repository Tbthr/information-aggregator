import { beijingDayRange, formatBeijingDate } from "../../lib/date-utils.js";
import type { AiClient } from "../ai/types.js";
import { fetchWithFallback, normalizeAiFlashMarkers } from "../utils/fetch-with-fallback.js";
import type { AiFlashSource } from "../types/config.js";
import { loadConfig } from "../config/index.js";

export type { AiFlashSource }

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
  /** 原始分类标签（如 hexi 的 "产品与功能更新"），AI 分类时的参考上下文 */
  sourceCategory?: string
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

  // Use fetchWithFallback (defuddle → jina) with source URL
  const url = source.url.replace('{month}', monthStr).replace('{date}', dateStr)
  const rawText = await fetchWithFallback(url, 20000, fetcher)
  if (!rawText) return null

  // Normalize markers so both defuddle and jina output work with same parsing
  const text = normalizeAiFlashMarkers(rawText)

  const lines = text.split('\n')
  let startIdx = -1
  let endIdx = lines.length

  for (let i = 0; i < lines.length; i++) {
    // hexi may output ## **今日摘要** (with bold markers), strip them for matching
    const stripped = lines[i].replace(/\*\*/g, '')
    if (stripped.includes('## 今日摘要') && !lines[i].startsWith('*')) {
      startIdx = i + 1
    }
    if (stripped.includes('## AI资讯日报多渠道')) {
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

// hexi 原始分类 → AI 标准分类 的语义映射
const CATEGORY_ALIAS: Record<string, string> = {
  "产品与功能更新": "产品更新",
  "前沿研究": "前沿研究",
  "行业展望与社会影响": "行业动态",
  "开源TOP项目": "开源项目",
  "社媒分享": "社媒精选",
  "行业动态": "行业动态",
  "开源项目": "开源项目",
}

function parseHexiMarkdownToItems(content: string): AiFlashItem[] {
  const lines = content.split('\n')
  const items: AiFlashItem[] = []
  let currentCategory = ''

  for (const line of lines) {
    // 检测分类标题，如 "### 产品与功能更新"
    const categoryMatch = line.match(/^###\s+(.+)/)
    if (categoryMatch) {
      const raw = categoryMatch[1].replace(/\[\]\([^)]+\)/, '').trim()
      // 映射到 AI 标准分类名，未知分类保持原样
      currentCategory = CATEGORY_ALIAS[raw] ?? raw
      continue
    }

    // 检测条目：numbered 格式 "1. **Title** rest"
    const numberedMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*(.+)$/)
    if (numberedMatch) {
      const title = numberedMatch[1].trim()
      let rest = numberedMatch[2]
      // Extract first [text](url) from rest BEFORE stripping links
      const firstLink = rest.match(/\[([^\]]+)\]\(([^)]+)\)/)
      const itemUrl = firstLink ? firstLink[2] : ''
      rest = rest.replace(/^[ ：]+/, '')
      rest = rest
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
      items.push({
        title,
        url: itemUrl,
        summary: rest.replace(/（来源：[^）]+）/g, '').trim().slice(0, 300),
        sourceName: '何夕2077',
        sourceCategory: currentCategory,
      })
      continue
    }

    // Bullet 格式：支持 • 和 - 两种 bullet 字符
    const bulletMatch = line.match(/^[•\-]\s+(.+)/)
    if (bulletMatch && currentCategory) {
      const raw = bulletMatch[1].trim()
      const urlMatch = raw.match(/\[([^\]]+)\]\(([^)]+)\)/)
      // Title: if link format, extract link text; otherwise strip ** markers
      let rawTitle = urlMatch ? urlMatch[1] : raw
      rawTitle = rawTitle.replace(/\*\*/g, '').trim()
      // Description: remove the [title](url) part first, then strip ** markers
      let rest = urlMatch ? raw.replace(/\[([^\]]+)\]\([^)]+\)/, '').trim() : raw
      rest = rest.replace(/^[ —：:]+/, '').trim()
      rest = rest
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim()
      items.push({
        title: rawTitle,
        url: urlMatch ? urlMatch[2] : '',
        summary: rest.replace(/（来源：[^）]+）/g, '').trim().slice(0, 300),
        sourceName: '何夕2077',
        sourceCategory: currentCategory,
      })
    }
  }

  return items
}

function parseClawfeedMarkdownToItems(content: string): AiFlashItem[] {
  const items: AiFlashItem[] = []
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
      pushCurrentItem()
      continue
    }

    // Check for item start: • or - followed by content
    const itemMatch = trimmed.match(/^[•\-]\s+(.+)/)
    if (itemMatch) {
      pushCurrentItem()

      const rest = itemMatch[1].trim()
      // Extract [text](url) first, then strip all markdown from title
      const urlMatch = rest.match(/\[([^\]]+)\]\(([^)]+)\)/)
      // Strip [text](url) link, then strip all ** and other markdown from title area
      let titleRaw = urlMatch ? rest.slice(0, rest.indexOf('[')) : rest
      // Also handle case where title is fully wrapped as [**Title**](url)
      if (!titleRaw.trim() && urlMatch) {
        titleRaw = urlMatch[1]
      }
      titleRaw = titleRaw.replace(/\*\*/g, '').trim()
      const summaryRest = urlMatch ? rest.replace(/\[([^\]]+)\]\([^)]+\)/, '').trim() : rest

      currentItem = {
        title: titleRaw || (urlMatch ? urlMatch[1] : rest).replace(/\*\*/g, '').trim(),
        url: urlMatch ? urlMatch[2] : '',
        summary: summaryRest.replace(/^[ —：:]+/, '').replace(/\*\*/g, '').replace(/（来源：[^）]+）/g, '').trim(),
      }
      currentMarkdownLines = [line]
    } else if (currentItem.title) {
      currentItem.summary = (currentItem.summary ?? '') + ' ' + trimmed
      currentMarkdownLines.push(line)
    }
  }

  pushCurrentItem()

  return items
}

function extractAllJuyaItems(itemHtml: string): { title: string; url: string; summary: string; links: string[] }[] {
  const results: { title: string; url: string; summary: string; links: string[] }[] = []

  // Find all h2 positions with their content blocks
  const h2Regex = /<h2><a href="([^"]+)">(.*?)<\/a>\s*<code>#(\d+)<\/code><\/h2>/g
  const h2Matches = [...itemHtml.matchAll(h2Regex)]

  for (let i = 0; i < h2Matches.length; i++) {
    const h2Match = h2Matches[i]
    const mainUrl = h2Match[1]
    const title = h2Match[2].trim()
    const blockStart = h2Match.index! + h2Match[0].length
    const blockEnd = i + 1 < h2Matches.length ? h2Matches[i + 1].index! : itemHtml.length

    const blockHtml = itemHtml.slice(blockStart, blockEnd)

    // Extract blockquote summary (only blockquote, not subsequent detail paragraphs)
    const bqMatch = /<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/.exec(blockHtml)
    const summary = bqMatch ? bqMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    // Extract related links (excluding main URL)
    const linkMatches = [...blockHtml.matchAll(/<li><a href="([^"]+)">(.*?)<\/a><\/li>/g)]
    const links = linkMatches.map(m => m[1]).filter(u => u !== mainUrl)

    results.push({ title, url: mainUrl, summary, links })
  }

  return results
}

async function fetchJuyaDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashItem[] | null> {
  const resp = await fetcher(source.url)
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
    const parsed = extractAllJuyaItems(item.content)
    for (const p of parsed) {
      flashItems.push({
        title: p.title,
        url: p.url,
        summary: p.summary,
        sourceName: '橘鸦AI早报',
      })
    }
  }
  if (flashItems.length === 0) return null
  return flashItems
}

async function fetchClawfeedDaily(source: AiFlashSource, fetcher: typeof fetch): Promise<AiFlashContent | null> {
  const resp = await fetcher(source.url)
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
): Promise<AiFlashCategory[]> {
  if (items.length === 0) return []

  const { dailyConfig } = await loadConfig()
  const systemPrompt = dailyConfig.aiFlashCategorization.prompt ||
    `你是一个内容分类助手。将输入的 AI 快讯条目分类到以下六个类别之一：产品更新 / 前沿研究 / 行业动态 / 开源项目 / 社媒精选 / 其他。不要改写任何内容，只输出 JSON。类别数量不超过 6 个。"其他"作为最后兜底。原文分类参考：产品与功能更新→产品更新；行业展望与社会影响→行业动态；开源TOP项目→开源项目；社媒分享→社媒精选；前沿研究→前沿研究。`

  const userPrompt = `请将以下条目分类，输出 JSON 格式：{ "categories": [{ "name": "分类名", "items": [{ "title": "...", "url": "...", "summary": "...", "sourceName": "..." }] }, ...] }。每个条目必须归属一个类别。

条目：
${items.map((item, i) => `${i + 1}. [${item.title}](${item.url}) — ${item.summary}`).join('\n')}

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
    const categories: AiFlashCategory[] = parsed.categories ?? fallbackCategorize(items)

    // Strip hallucinated source attributions (e.g., "（来源：何夕2077）") from AI output
    for (const cat of categories) {
      for (const item of cat.items) {
        item.summary = item.summary.replace(/（来源：[^）]+）/g, '').trim()
      }
    }

    return categories
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
      } catch (err) {
        console.warn(`[ai-flash] Source ${source.id} failed:`, err)
      }
    })
  )

  return results
}
