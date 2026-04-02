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
import yaml from 'js-yaml'
import { getQuadrantPrompt, parseQuadrantResult } from '../ai/prompts-reports.js'
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
// Config
// ============================================================

interface DailyConfig {
  maxItems: number
  minScore: number
}

function loadReportsConfig(): DailyConfig {
  const configPath = path.join(process.cwd(), 'config', 'reports.yaml')
  const content = fs.readFileSync(configPath, 'utf-8')
  const raw = yaml.load(content) as { daily: DailyConfig }
  return raw.daily
}

// ============================================================
// Scoring
// ============================================================

function computeBaseScore(article: normalizedArticle): number {
  const engagementBonus = Math.min(article.engagementScore ?? 0, 0.25)
  const sourceBonus = Math.min(article.sourceWeightScore ?? 0, 0.25)
  return 0.5 + engagementBonus + sourceBonus
}

// ============================================================
// Quadrant Classification
// ============================================================

async function classifyArticleQuadrant(
  article: normalizedArticle,
  aiClient: AiClient
): Promise<Quadrant> {
  const summary = (article.normalizedSummary || '')?.slice(0, 300) ?? ''
  const title = article.title || article.normalizedTitle || ''
  const prompt = `${getQuadrantPrompt()}\n\n内容标题：${title}\n内容摘要：${summary}`

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await aiClient.generateText(prompt)
      const parsed = parseQuadrantResult(result)
      if (parsed) {
        return parsed.quadrant
      }
    } catch {
      // retry
    }
  }

  return '地图感'
}

// ============================================================
// Markdown Output
// ============================================================

export function generateDailyMarkdown(report: DailyReportData): string {
  const lines: string[] = []

  lines.push(`# ${report.dateLabel}`)
  lines.push('')
  lines.push('本报告由 AI 自动生成')
  lines.push('')

  for (const quad of report.quadrants) {
    lines.push(`## ${quad.quadrant} ⓘ`)
    lines.push('')

    if (quad.articles.length === 0) {
      lines.push('无内容')
      lines.push('')
      continue
    }

    lines.push('**引用文章：**')
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
  articles: normalizedArticle[]
): Promise<DailyGenerateResult> {
  const dateStr = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  const config = loadReportsConfig()

  if (articles.length === 0) {
    return { date: dateStr, articleCount: 0, errorSteps }
  }

  // Step 2: Classify each article by quadrant
  const classified: { article: normalizedArticle; score: number; quadrant: Quadrant }[] = []

  for (const article of articles) {
    const baseScore = computeBaseScore(article)
    const quadrant = await classifyArticleQuadrant(article, aiClient)
    classified.push({ article, score: baseScore, quadrant })
  }

  // Step 3: Filter by minScore and sort by score desc
  const filtered = classified
    .filter(c => c.score >= config.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxItems)

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
