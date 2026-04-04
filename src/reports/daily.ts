/**
 * Daily Report Generator — Dual-module structure (AI Flash + Article List)
 *
 * Architecture:
 * 1. Accept pre-processed articles (from pipeline)
 * 2. Fetch AI flash content from dedicated adapters (hexi-daily, juya-daily, clawfeed-daily)
 * 3. Output to Markdown (reports/daily/YYYY-MM-DD.md)
 *    - AI快讯 section (from dedicated adapters)
 *    - 文章列表 section (from pipeline articles)
 */

import fs from 'fs'
import path from 'path'
import type { AiClient } from '../ai/types.js'
import { formatUtcDate, formatUtcDayLabel } from '../../lib/date-utils.js'
import type { normalizedArticle } from '../types/index.js'
import type { AiFlashSource, AiFlashContent } from './ai-flash.js'

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
  aiFlash: AiFlashContent[]
  articles: ArticleForReport[]
}

// ============================================================
// Markdown Output
// ============================================================

export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []

  lines.push(`# ${report.dateLabel}`)
  lines.push('')

  lines.push('## AI快讯')
  lines.push('')
  for (const flash of report.aiFlash) {
    lines.push(`### ${flash.sourceName}`)
    lines.push('')
    lines.push(flash.content)
    lines.push('')
  }

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
 * 3. Map articles for report output
 * 4. Output to Markdown
 */
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: normalizedArticle[],
  aiFlashSources: AiFlashSource[]
): Promise<DailyGenerateResult> {
  const dateStr = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // Fetch AI flash sources (fail-silent, imported from ai-flash.ts)
  const { fetchAiFlashSources } = await import('./ai-flash.js')
  const aiFlash = await fetchAiFlashSources(aiFlashSources, {})

  // Map articles for report
  const reportArticles: ArticleForReport[] = articles.map(a => ({
    title: a.title || a.normalizedTitle || '',
    url: a.normalizedUrl || '',
    sourceName: a.sourceName || a.sourceId || '',
  }))

  const reportData: DailyReportData = {
    date: dateStr,
    dateLabel: `${dayLabel} 日报`,
    aiFlash,
    articles: reportArticles,
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

  return { date: dateStr, articleCount: reportArticles.length, errorSteps }
}
