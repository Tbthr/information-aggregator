/**
 * Daily Report Generator — JSON-based pipeline (no Prisma)
 *
 * Architecture:
 * 1. Accept pre-processed articles (from pipeline)
 * 2. Classify each article into a quadrant (尝试/深度/地图感) using AI
 * 3. Group articles by quadrant
 * 4. Output to Markdown (reports/daily/YYYY-MM-DD.md)
 */

import fs from 'fs'
import path from 'path'
import type { AiClient } from '../ai/types.js'
import { formatUtcDate, formatUtcDayLabel } from '../../lib/date-utils.js'
import type { normalizedArticle } from '../types/index.js'

// ============================================================
// Types
// ============================================================

export interface DailyGenerateResult {
  date: string
  articleCount: number
  errorSteps: string[]
}

interface ArticleForReport {
  title: string
  url: string
  sourceName: string
}

interface DailyReportData {
  date: string
  dateLabel: string
  quadrants: QuadrantData[]
}

type Quadrant = '尝试' | '深度' | '地图感'

interface QuadrantData {
  quadrant: Quadrant
  articles: ArticleForReport[]
}

// ============================================================
// Quadrant Classification
// ============================================================

async function classifyArticlesQuadrantBatch(
  articles: normalizedArticle[],
  aiClient: AiClient,
  quadrantPrompt: string
): Promise<Map<string, Quadrant>> {
  const idAndContent = articles.map((a, i) => ({
    id: a.id || `article-${i}`,
    title: a.title || a.normalizedTitle || '',
    content: (a.normalizedContent || '')?.slice(0, 2000) ?? '',
  }))

  const prompt = `${quadrantPrompt}\n\n请对以下所有内容进行分类，返回JSON数组格式：\n${JSON.stringify(idAndContent, null, 2)}\n\n返回格式：\n[{"id": "文章id", "quadrant": "尝试|深度|地图感", "reason": "理由"}]`

  const resultMap = new Map<string, Quadrant>()

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await aiClient.generateText(prompt)

      // Try parsing as JSON array
      let items: { id: string; quadrant: string }[] = []
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          items = parsed
        }
      } catch {
        // Try extracting from markdown code block
        const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
        if (match) {
          try {
            items = JSON.parse(match[1])
          } catch { /* ignore */ }
        }
      }

      if (items.length > 0) {
        for (const item of items) {
          if (['尝试', '深度', '地图感'].includes(item.quadrant)) {
            resultMap.set(item.id, item.quadrant as Quadrant)
          }
        }
        if (resultMap.size > 0) return resultMap
      }
    } catch {
      // retry
    }
  }

  // Fallback: all to 地图感
  for (const a of articles) {
    const id = a.id || `article-${articles.indexOf(a)}`
    resultMap.set(id, '地图感')
  }
  return resultMap
}

// ============================================================
// Markdown Output
// ============================================================

export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []

  lines.push(`# ${report.dateLabel}`)
  lines.push('')
  for (const quad of report.quadrants) {
    lines.push(`## ${quad.quadrant} ⓘ`)
    lines.push('')

    if (quad.articles.length === 0) {
      lines.push('无内容')
      lines.push('')
      continue
    }

    for (const article of quad.articles) {
      lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================
// Main Pipeline
// ============================================================

/**
 * Generates a daily report.
 *
 * Pipeline:
 * 1. Accept pre-processed articles (normalizedArticle[] from pipeline)
 * 2. Classify each article into a quadrant using AI
 * 3. Group by quadrant
 * 4. Output to Markdown
 */
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: normalizedArticle[],
  quadrantPrompt: string
): Promise<DailyGenerateResult> {
  const dateStr = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  if (articles.length === 0) {
    return { date: dateStr, articleCount: 0, errorSteps }
  }

  // Step 2: Classify all articles by quadrant (single batch AI call)
  const quadrantMap = await classifyArticlesQuadrantBatch(articles, aiClient, quadrantPrompt)

  const classified: { article: normalizedArticle; quadrant: Quadrant }[] = []
  for (const article of articles) {
    const id = article.id || `article-${articles.indexOf(article)}`
    const quadrant = quadrantMap.get(id) ?? '地图感'
    classified.push({ article, quadrant })
  }

  // Step 3: 取所有已分类的文章（pipeline 已排序）
  const filtered = classified

  if (filtered.length === 0) {
    return { date: dateStr, articleCount: 0, errorSteps }
  }

  // Step 4: Group by quadrant
  const byQuadrant = new Map<Quadrant, normalizedArticle[]>()
  for (const { article, quadrant } of filtered) {
    const list = byQuadrant.get(quadrant) ?? []
    list.push(article)
    byQuadrant.set(quadrant, list)
  }

  // Build quadrant data
  const quadrants: QuadrantData[] = []
  let totalArticles = 0

  for (const q of (['尝试', '深度', '地图感'] as Quadrant[])) {
    const quadArticles = byQuadrant.get(q) ?? []
    quadrants.push({
      quadrant: q,
      articles: quadArticles.map(a => ({
        title: a.title || a.normalizedTitle || '',
        url: a.normalizedUrl || '',
        sourceName: a.sourceName || a.sourceId || '',
      })),
    })
    totalArticles += quadArticles.length
  }

  // Step 5: Write Markdown output
  const reportData: DailyReportData = {
    date: dateStr,
    dateLabel: `${dayLabel} 日报`,
    quadrants,
  }

  const markdown = generateDailyMarkdown(reportData)
  const outputDir = path.join(process.cwd(), 'reports', 'daily')
  const outputPath = path.join(outputDir, `${dateStr}.md`)

  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(outputPath, markdown, 'utf-8')
  } catch {
    errorSteps.push('writeOutput')
  }

  return { date: dateStr, articleCount: totalArticles, errorSteps }
}
