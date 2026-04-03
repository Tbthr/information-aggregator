/**
 * Daily Report Generator
 *
 * 架构：
 * 1. 接收 pipeline 处理后的 articles
 * 2. 按 feedType 分流：
 *    - digest → AI 快讯（分类+去重 → 要点列表）
 *    - article → 文章列表（直接列出）
 * 3. 输出到 Markdown (reports/daily/YYYY-MM-DD.md)
 */

import fs from 'fs'
import path from 'path'
import type { AiClient } from '../ai/types.js'
import { formatUtcDate, formatUtcDayLabel } from '../../lib/date-utils.js'
import type { normalizedArticle } from '../types/index.js'
import type { DailyConfig } from '../config/index.js'
import { extractDigests, classifyAndDedupDigests, generateDigestMarkdown } from './digest.js'
import type { ArticleForReport } from './types.js'

// ============================================================
// Types
// ============================================================

export interface DailyGenerateResult {
  date: string
  articleCount: number
  digestItemCount: number
  errorSteps: string[]
}

// ============================================================
// Markdown 生成
// ============================================================

function generateArticleListMarkdown(articles: ArticleForReport[]): string {
  const lines: string[] = []

  if (articles.length === 0) {
    lines.push('无内容')
    lines.push('')
    return lines.join('\n')
  }

  for (const article of articles) {
    lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
  }
  lines.push('')

  return lines.join('\n')
}

export function generateDailyMarkdown(
  dateLabel: string,
  digestMarkdown: string | null,
  articles: ArticleForReport[]
): string {
  const lines: string[] = []

  lines.push(`# ${dateLabel}`)
  lines.push('')

  if (digestMarkdown) {
    lines.push('## AI 快讯 ⓘ')
    lines.push('')
    lines.push(digestMarkdown)
    lines.push('')
  }

  lines.push('## 文章列表 ⓘ')
  lines.push('')
  lines.push(generateArticleListMarkdown(articles))

  return lines.join('\n')
}

// ============================================================
// Main Pipeline
// ============================================================

/**
 * 生成日报
 *
 * Pipeline:
 * 1. 接收 pipeline 处理后的 articles
 * 2. 按 feedType 分流：digest / article
 * 3. digest → AI 分类去重 → 要点列表
 * 4. article → 简单列表
 * 5. 输出到 Markdown
 */
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: normalizedArticle[],
  dailyConfig: DailyConfig
): Promise<DailyGenerateResult> {
  const dateStr = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // 分流
  const digestItems = extractDigests(articles)
  const articleItems = articles.filter(a => a.feedType !== 'digest')

  // AI 快讯处理
  let digestMarkdown: string | null = null
  if (digestItems.length > 0 && dailyConfig.digestPrompt) {
    try {
      const digestResult = await classifyAndDedupDigests(
        digestItems,
        aiClient,
        dailyConfig.digestPrompt
      )
      digestMarkdown = generateDigestMarkdown(digestResult)
    } catch {
      errorSteps.push('digest')
    }
  }

  // 文章列表
  const articleForReports: ArticleForReport[] = articleItems.map(a => ({
    title: a.title || a.normalizedTitle || '',
    url: a.normalizedUrl || '',
    sourceName: a.sourceName || a.sourceId || '',
  }))

  // 生成 Markdown
  const markdown = generateDailyMarkdown(`${dayLabel} 日报`, digestMarkdown, articleForReports)
  const outputDir = path.join(process.cwd(), 'reports', 'daily')
  const outputPath = path.join(outputDir, `${dateStr}.md`)

  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(outputPath, markdown, 'utf-8')
  } catch {
    errorSteps.push('writeOutput')
  }

  return {
    date: dateStr,
    articleCount: articleForReports.length,
    digestItemCount: digestItems.length,
    errorSteps,
  }
}
