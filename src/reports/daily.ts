/**
 * Daily Report Generator — JSON-based pipeline (no Prisma)
 *
 * Architecture:
 * 1. Accept pre-processed articles (from pipeline)
 * 2. Classify each article into a quadrant (尝试/深度/地图感) using AI
 * 3. Group articles by quadrant
 * 4. Within each quadrant, cluster articles into topics using AI
 * 5. Generate summary + key points for each topic using AI
 * 6. Output to Markdown (reports/daily/YYYY-MM-DD.md)
 */

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import {
  QUADRANT_PROMPT,
  TOPIC_CLUSTER_PROMPT,
  parseQuadrantResult,
  parseTopicClusterResult,
} from '../ai/prompts-reports.js'
import type { AiClient } from '../ai/types.js'
import { formatUtcDate, formatUtcDayLabel } from '../../lib/date-utils.js'
import type { RankedCandidate } from '../types/index.js'

// ============================================================
// Types
// ============================================================

export interface DailyGenerateResult {
  date: string
  topicCount: number
  errorSteps: string[]
}

interface TopicGroup {
  title: string
  summary: string
  keyPoints: string[]
  articles: ArticleForReport[]
}

interface ArticleForReport {
  title: string
  url: string
  sourceName: string
}

interface DailyReportData {
  date: string
  dateLabel: string
  quadrantGroups: QuadrantGroup[]
}

type Quadrant = '尝试' | '深度' | '地图感'

interface QuadrantGroup {
  quadrant: Quadrant
  topics: TopicGroup[]
}

// ============================================================
// Config
// ============================================================

interface DailyConfig {
  maxItems: number
  minScore: number
  topicSummaryPrompt?: string
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

const QUADRANT_BONUS: Record<Quadrant, number> = {
  '尝试': 1.3,
  '深度': 1.0,
  '地图感': 0.8,
}

function computeBaseScore(article: RankedCandidate): number {
  // Base score from engagement + quality (each contributes up to 0.25)
  const engagementBonus = Math.min(article.engagementScore ?? 0, 0.25)
  const qualityBonus = Math.min(article.contentQualityAi ?? 0, 0.25)
  return 0.5 + engagementBonus + qualityBonus
}

// ============================================================
// Quadrant Classification
// ============================================================

async function classifyArticleQuadrant(
  article: RankedCandidate,
  aiClient: AiClient
): Promise<Quadrant> {
  const text = buildQuadrantPromptText(article)

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await aiClient.generateText(text)
      const parsed = parseQuadrantResult(result)
      if (parsed) {
        return parsed.quadrant
      }
    } catch {
      // retry
    }
  }

  // Fallback: default to 地图感
  return '地图感'
}

function buildQuadrantPromptText(article: RankedCandidate): string {
  const summary = (article.normalizedText || '')?.slice(0, 300) ?? ''
  const title = article.title || article.normalizedTitle || ''
  return `${QUADRANT_PROMPT}\n\n内容标题：${title}\n内容摘要：${summary}`
}

// ============================================================
// Topic Clustering
// ============================================================

async function generateTopicGroups(
  articles: RankedCandidate[],
  aiClient: AiClient,
  _config: DailyConfig
): Promise<TopicGroup[]> {
  if (articles.length === 0) return []

  const contentList = articles.map((a, i) => {
    const summary = (a.normalizedText || '')?.slice(0, 200) ?? ''
    const title = a.title || a.normalizedTitle || ''
    const kind = a.contentType === 'tweet' ? '推文' : '文章'
    return `[${i}] [${kind}] ${title}: ${summary}`
  })

  const prompt = `${TOPIC_CLUSTER_PROMPT}\n\n内容列表：\n${contentList.join('\n')}`

  try {
    const result = await aiClient.generateText(prompt)
    const parsed = parseTopicClusterResult(result)

    if (parsed && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
      // Build TopicGroup for each cluster returned by AI
      const groups: TopicGroup[] = parsed.topics
        .filter(t => Array.isArray(t.articleIndexes) && t.articleIndexes.length > 0)
        .map(t => ({
          title: t.title || '未命名话题',
          summary: t.summary || '',
          keyPoints: Array.isArray(t.keyPoints) ? t.keyPoints : [],
          articles: t.articleIndexes
            .filter(idx => idx >= 0 && idx < articles.length)
            .map(idx => ({
              title: articles[idx].title || articles[idx].normalizedTitle || '',
              url: articles[idx].url || articles[idx].canonicalUrl || '',
              sourceName: articles[idx].sourceName || '',
            })),
        }))

      if (groups.length > 0) {
        return groups
      }
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: single topic with all articles
  return [{
    title: '今日内容',
    summary: `共 ${articles.length} 条内容`,
    keyPoints: [],
    articles: articles.map(a => ({
      title: a.title || a.normalizedTitle || '',
      url: a.url || a.canonicalUrl || '',
      sourceName: a.sourceName || '',
    })),
  }]
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

  for (const group of report.quadrantGroups) {
    lines.push(`## ${group.quadrant} ⓘ`)
    lines.push('')

    if (group.topics.length === 0) {
      lines.push('无内容')
      lines.push('')
      continue
    }

    for (const topic of group.topics) {
      lines.push(`### ${topic.title}`)
      lines.push('')
      lines.push(topic.summary)
      lines.push('')

      if (topic.keyPoints.length > 0) {
        lines.push('**核心要点：**')
        for (const point of topic.keyPoints) {
          lines.push(`- ${point}`)
        }
        lines.push('')
      }

      lines.push('**引用文章：**')
      for (const article of topic.articles) {
        lines.push(`- [${article.title}](${article.url}) (${article.sourceName})`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ============================================================
// Main Pipeline
// ============================================================

/**
 * Generates a daily report using the quadrant-aware pipeline.
 *
 * Pipeline:
 * 1. Accept pre-processed articles (RankedCandidate[] from pipeline)
 * 2. Score and classify each article into a quadrant using AI
 * 3. Group by quadrant
 * 4. Cluster articles into topics within each quadrant
 * 5. Generate summary + key points for each topic
 * 6. Output to Markdown
 */
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient,
  articles: RankedCandidate[]
): Promise<DailyGenerateResult> {
  const dateStr = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // Load config
  let config: DailyConfig
  try {
    config = loadReportsConfig()
  } catch {
    config = { maxItems: 50, minScore: 0 }
  }

  if (articles.length === 0) {
    return { date: dateStr, topicCount: 0, errorSteps }
  }

  // Step 2: Score and classify each article by quadrant
  const scoredArticles: { article: RankedCandidate; score: number; quadrant: Quadrant }[] = []

  for (const article of articles) {
    const baseScore = computeBaseScore(article)
    const quadrant = await classifyArticleQuadrant(article, aiClient)
    const finalScore = baseScore * QUADRANT_BONUS[quadrant]
    scoredArticles.push({ article, score: finalScore, quadrant })
  }

  // Step 3: Filter by minScore and sort by score desc
  const filtered = scoredArticles
    .filter(c => c.score >= config.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxItems)

  if (filtered.length === 0) {
    return { date: dateStr, topicCount: 0, errorSteps }
  }

  // Step 4: Group by quadrant (preserving order)
  const byQuadrant = new Map<Quadrant, RankedCandidate[]>()
  for (const { article, quadrant } of filtered) {
    const list = byQuadrant.get(quadrant) ?? []
    list.push(article)
    byQuadrant.set(quadrant, list)
  }

  // Step 5: Generate topic groups for each quadrant
  const quadrantGroups: QuadrantGroup[] = []
  let totalTopics = 0

  for (const quadrant of (['尝试', '深度', '地图感'] as Quadrant[])) {
    const quadrantArticles = byQuadrant.get(quadrant) ?? []

    if (quadrantArticles.length === 0) {
      quadrantGroups.push({ quadrant, topics: [] })
      continue
    }

    const topics = await generateTopicGroups(quadrantArticles, aiClient, config)
    totalTopics += topics.length
    quadrantGroups.push({ quadrant, topics })
  }

  // Step 6: Write Markdown output
  const reportData: DailyReportData = {
    date: dateStr,
    dateLabel: `${dayLabel} 日报`,
    quadrantGroups,
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

  return { date: dateStr, topicCount: totalTopics, errorSteps }
}
