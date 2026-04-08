/**
 * Daily Report Generator — Dual-module structure (AI Flash + Article List)
 *
 * Architecture:
 * 1. Accept pre-processed articles (from pipeline)
 * 2. Fetch AI flash content from dedicated adapters (hexi-daily, juya-daily, clawfeed-daily)
 * 3. Output to Markdown (content/daily/YYYY-MM-DD.md) with Zola front matter
 *    - AI快讯 section (from dedicated adapters, categorized)
 *    - 推特精选 section (ClawFeed, original markdown format)
 *    - 文章列表 section (from pipeline articles)
 */

import fs from 'fs'
import path from 'path'
import type { AiClient } from '../ai/types.js'
import { formatUtcDate, formatUtcDayLabel } from '../../lib/date-utils.js'
import type { normalizedArticle } from '../types/index.js'
import type { AiFlashSource, AiFlashItem, AiFlashCategory, AiFlashContent } from './ai-flash.js'
import { categorizeAiFlash, fetchAiFlashSources } from './ai-flash.js'
import type { DailyConfig } from '../config/index.js'

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

export interface DailyReportData {
  date: string
  dateLabel: string
  mergedAiFlash: AiFlashCategory[]   // 分类后的 AI快讯（来自 hexi + juya）
  clawfeed: AiFlashContent | null     // ClawFeed 独立（保持原格式，不分类）
  articles: ArticleForReport[]
}

// ============================================================
// Markdown Output
// ============================================================

export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []

  // Zola front matter
  lines.push('+++')
  lines.push(`title = "${report.dateLabel}"`)
  lines.push(`date = ${report.date}`)
  lines.push('render = true')
  lines.push('+++')
  lines.push('')

  // ## AI快讯
  lines.push('## AI快讯')
  lines.push('')
  if (report.mergedAiFlash.length === 0) {
    lines.push('暂无内容')
  } else {
    for (const category of report.mergedAiFlash) {
      lines.push(`### ${category.name}`)
      lines.push('')
      for (const item of category.items) {
        const titleMd = item.url ? `[**${item.title}**](${item.url})` : `**${item.title}**`
        lines.push(`- ${titleMd} — ${item.summary}`)
      }
      lines.push('')
    }
  }

  // ## 推特精选
  lines.push('## 推特精选')
  lines.push('')
  if (report.clawfeed) {
    lines.push(report.clawfeed.content)
  } else {
    lines.push('暂无内容')
  }
  lines.push('')

  // ## 文章列表
  lines.push('## 文章列表')
  lines.push('')
  for (const article of report.articles) {
    lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
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
 * 2. Fetch AI flash content from dedicated adapters (fail-silent)
 * 3. Separate ClawFeed from hexi+juya
 * 4. Categorize hexi+juya items via AI
 * 5. Build report data and output to Markdown
 */
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: normalizedArticle[],
  aiFlashSources: AiFlashSource[],
  dailyConfig: DailyConfig,
): Promise<DailyGenerateResult> {
  const dateStr = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // Fetch AI flash sources (returns AiFlashItem[])
  const flashSources = await fetchAiFlashSources(aiFlashSources, { fetchImpl: fetch })

  // Separate ClawFeed items from hexi+juya
  const clawfeedItems = flashSources.filter(item => item.sourceName === 'ClawFeed')
  const hexiJuyaItems = flashSources.filter(item => item.sourceName !== 'ClawFeed')

  // Categorize only hexi+juya items
  let categorizedFlash: AiFlashCategory[]
  if (dailyConfig.aiFlashCategorization.enabled) {
    categorizedFlash = await categorizeAiFlash(hexiJuyaItems, aiClient, dailyConfig.aiFlashCategorization)
  } else {
    // Use unclassified items directly under "其他" category (like fallbackCategorize)
    categorizedFlash = [{ name: '其他', items: hexiJuyaItems }]
  }

  // Build ClawFeed content from original markdown
  const clawfeedContent: AiFlashContent | null = clawfeedItems.length > 0
    ? {
        sourceId: 'clawfeed',
        sourceName: 'ClawFeed',
        publishedAt: new Date().toISOString(),
        content: clawfeedItems.map(item => item.originalMarkdown ?? '').filter(Boolean).join('\n\n'),
      }
    : null

  // Map articles for report
  const reportArticles: ArticleForReport[] = articles.map(a => ({
    title: a.title || a.normalizedTitle || '',
    url: a.normalizedUrl || '',
    sourceName: a.sourceName || a.sourceId || '',
  }))

  const reportData: DailyReportData = {
    date: dateStr,
    dateLabel: `${dayLabel} 日报`,
    mergedAiFlash: categorizedFlash,
    clawfeed: clawfeedContent,
    articles: reportArticles,
  }

  const markdown = generateDailyMarkdown(reportData)
  const outputDir = path.join(process.cwd(), 'content', 'daily')
  const outputPath = path.join(outputDir, `${dateStr}.md`)

  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(outputPath, markdown, 'utf-8')
  } catch {
    errorSteps.push('writeOutput')
  }

  return { date: dateStr, articleCount: reportArticles.length, errorSteps }
}
