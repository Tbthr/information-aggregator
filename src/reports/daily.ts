import { prisma } from "@/lib/prisma"
import type { Content, DailyReportConfig } from "@prisma/client"
import type { ReportCandidate, ScoreBreakdown, SignalScores } from "@/src/types/index"
import { formatUtcDate, formatUtcDayLabel, beijingDayRange } from "@/lib/date-utils"
import { contentToReportCandidate } from "./report-candidate"
import {
  applyBaseStage,
  applyTweetSignalScoring,
  applyItemSignalScoring,
  applyMergeStage,
  applyHistoryPenaltyStage,
  type KindPreferences,
  type ScoredCandidate as ScoringScoredCandidate,
} from "./scoring"

export interface DailyGenerateResult {
  date: string
  topicCount: number
  errorSteps: string[]
}

// Re-export ScoredCandidate from scoring types for external consumers
export type ScoredCandidate = ScoringScoredCandidate

// ============================================================
// Pure pipeline functions (exported for testing)
// ============================================================

/**
 * Maps DB Content records to unified ReportCandidate[].
 * Content is the unified content model that replaces Item and Tweet.
 */
export function collectCandidates(contents: Content[]): ReportCandidate[] {
  return contents.map(contentToReportCandidate)
}

/**
 * Parses kindPreferences from DailyReportConfig JSON field.
 * Returns empty object for null, empty, or invalid JSON.
 */
export function parseKindPreferences(raw: string | null | undefined): KindPreferences {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null) return parsed
    return {}
  } catch {
    return {}
  }
}

/**
 * Runs the full scoring pipeline on candidates.
 *
 * Stages:
 * 1. Base stage: apply kind preferences
 * 2. Signal stage: tweet engagement signals / item signals
 * 3. Merge stage: combine into runtimeScore
 * 4. History penalty stage: penalize recently seen items/tweets
 */
export function scoreCandidates(
  candidates: ReportCandidate[],
  options: {
    kindPreferences: KindPreferences
    recentCandidates?: ReportCandidate[]
    tweetEngagements?: Map<string, { likeCount?: number; replyCount?: number; retweetCount?: number }>
  }
): ScoredCandidate[] {
  const { kindPreferences, recentCandidates = [], tweetEngagements } = options

  return candidates.map((candidate) => {
    // Stage 1: Base
    const { baseScore } = applyBaseStage({ candidate, kindPreferences })

    // Stage 2: Signals (kind-specific)
    let signalScores: SignalScores
    if (candidate.kind === "tweet") {
      const engagement = tweetEngagements?.get(candidate.id)
      const tweetResult = applyTweetSignalScoring({ candidate, engagement })
      signalScores = tweetResult.signalScores
    } else {
      const itemResult = applyItemSignalScoring({ candidate })
      signalScores = itemResult.signalScores
    }

    // Stage 3: Merge
    const { runtimeScore } = applyMergeStage({ baseScore, signalScores })

    // Stage 4: History penalty
    const { historyPenalty, finalScore } = applyHistoryPenaltyStage({
      runtimeScore,
      candidate,
      recentCandidates,
    })

    const breakdown: ScoreBreakdown = {
      baseScore,
      signalScores,
      runtimeScore,
      historyPenalty,
      finalScore,
    }

    return { ...candidate, breakdown }
  })
}

/**
 * Trims scored candidates to top N by finalScore (descending).
 * This reduces AI cost by sending fewer items to the clustering prompt.
 */
export function trimTopN(scored: ScoredCandidate[], n: number): ScoredCandidate[] {
  if (n <= 0) return []
  if (scored.length <= n) return scored
  return [...scored].sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore).slice(0, n)
}

/**
 * Converts ReportCandidate[] to TopicClusterItem[] for AI clustering.
 * Articles use type="item", tweets use type="tweet" with @handle as title.
 */
// ============================================================
// Internal pipeline steps (async, DB-dependent)
// ============================================================

/** Step 1: Collect Content records from the target Beijing day range */
async function collectData(now: Date) {
  const dateStr = formatUtcDate(now)
  const { start, end } = beijingDayRange(dateStr)

  const contents = await prisma.content.findMany({
    where: { publishedAt: { gte: start, lte: end } },
    orderBy: { publishedAt: "desc" },
  })

  return { contents }
}

/** Step 2: Filter by topic and excludeRules */
async function filterContent(
  contents: Content[],
  config: DailyReportConfig
): Promise<{ filteredContents: Content[] }> {
  // Topic filtering: if topicIds specified, only include contents matching those topics
  let topicFilteredContents = contents
  if (config.topicIds.length > 0) {
    topicFilteredContents = contents.filter((content) =>
      content.topicIds.some((tid) => config.topicIds.includes(tid))
    )
    if (topicFilteredContents.length === 0) {
      console.warn(`[daily-report] topicIds ${config.topicIds.join(", ")} 下无内容，所有条目将被过滤`)
    }
  }

  // Load topics to get excludeRules
  const { loadTopicsByIds } = await import("@/src/config/load-pack-prisma")
  const topics = await loadTopicsByIds(config.topicIds)

  // Build excludeRules map: topicId -> keywords[]
  const excludeRulesMap = new Map<string, string[]>()
  for (const topic of topics) {
    if (topic.excludeRules.length > 0) {
      excludeRulesMap.set(topic.id, topic.excludeRules)
    }
  }

  // Filter: exclude content if any of its topic's excludeRules match content title+body
  const filteredContents = topicFilteredContents.filter((content) => {
    for (const tid of content.topicIds) {
      const keywords = excludeRulesMap.get(tid)
      if (!keywords) continue
      const text = (content.title ?? "") + " " + (content.body ?? "")
      if (keywords.some((kw) => text.toLowerCase().includes(kw.toLowerCase()))) {
        return false // excluded
      }
    }
    return true
  })

  return { filteredContents }
}

/** Step 3: Persist results */
async function persistResults(
  date: string,
  dayLabel: string,
  topics: { title: string; summary: string; contentIds: string[] }[],
  errorMessage?: string,
  errorSteps?: string[]
) {
  return prisma.$transaction(async (tx) => {
    // Upsert DailyOverview
    const overview = await tx.dailyOverview.upsert({
      where: { date },
      create: {
        date,
        dayLabel,
        topicCount: topics.length,
        errorMessage,
        errorSteps: errorSteps ?? [],
      },
      update: {
        dayLabel,
        topicCount: topics.length,
        errorMessage,
        errorSteps: errorSteps ?? [],
      },
    })

    // Delete old topics
    await tx.digestTopic.deleteMany({ where: { dailyId: overview.id } })

    // Create new topics with contentIds
    if (topics.length > 0) {
      await tx.digestTopic.createMany({
        data: topics.map((topic, index) => ({
          dailyId: overview.id,
          order: index,
          title: topic.title,
          summary: topic.summary,
          contentIds: topic.contentIds,
        })),
      })
    }

    return overview
  })
}

// ============================================================
// Fallback: Category-based grouping when AI clustering fails
// ============================================================

function fallbackCategoryGrouping(candidates: ScoredCandidate[]): { title: string; summary: string; contentIds: string[] }[] {
  const articleCandidates = candidates.filter((c) => c.kind === "article")
  if (articleCandidates.length === 0) return []

  // Group by sourceLabel as fallback when AI clustering fails
  const groups = new Map<string, ScoredCandidate[]>()
  for (const c of articleCandidates) {
    const key = c.sourceLabel || "其他"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  return Array.from(groups.entries()).map(([groupKey, groupItems]) => ({
    title: groupKey.slice(0, 20),
    summary: groupItems[0].summary,
    contentIds: groupItems.map((c) => c.id),
  }))
}

// ============================================================
// Main Pipeline
// ============================================================

/**
 * Generates a daily report using the new runtime candidates pipeline.
 *
 * Pipeline order:
 * 1. Collect items + tweets from DB (Beijing day range)
 * 2. Filter by pack, blacklist, min score (DB-level)
 * 3. Map to ReportCandidate[]
 * 4. Score candidates (base -> signal -> merge -> history penalty)
 * 5. Trim to top N (before AI, to reduce cost)
 * 6. Persist results (category grouping as fallback)
 */
export async function generateDailyReport(
  now: Date
): Promise<DailyGenerateResult> {
  const date = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // Load config
  let config = await prisma.dailyReportConfig.findUnique({ where: { id: "default" } })
  if (!config) {
    // This fallback should not happen in production since DB has defaults
    // These prompts include JSON output instructions as a safety measure
    const defaultTopicPrompt = `你是一位专业的信息分析师。请将以下内容列表按照话题进行聚类分组。

要求：
1. 分成 3-8 个话题
2. 每个话题内的内容应该高度相关
3. 每条内容只能属于一个话题
4. 不要遗漏重要内容
5. 话题标题简洁有力（中文，10字以内）

请以 JSON 格式输出：

{
  "topics": [
    {
      "title": "话题标题",
      "itemIndexes": [0, 1, 2],
      "tweetIndexes": []
    }
  ]
}`
    const defaultTopicSummaryPrompt = `你是一位专业的信息分析师。请为以下话题下的内容生成一段综合总结。

要求：
1. 总结应该提炼核心信息和关键趋势
2. 200-400字
3. 用中文撰写
4. 不要简单罗列，要综合分析

请直接输出总结文本，不要包含 JSON 格式或额外标记。`
    config = await prisma.dailyReportConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        filterPrompt: "",
        topicPrompt: defaultTopicPrompt,
        topicSummaryPrompt: defaultTopicSummaryPrompt,
      },
      update: {},
    })
  }

  // Step 1: Collect data from DB
  let contents: Content[]
  try {
    const result = await collectData(now)
    contents = result.contents
  } catch {
    errorSteps.push("dataCollection")
    await persistResults(date, dayLabel, [], "数据收集失败", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 2: Topic-level filtering (topicIds, blacklist, min score)
  const { filteredContents } = await filterContent(contents, config)

  if (filteredContents.length === 0) {
    await persistResults(date, dayLabel, [], "过去24小时无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 3: Map to ReportCandidate[]
  const candidates = collectCandidates(filteredContents)

  // Step 4: Score all candidates
  const kindPreferences = parseKindPreferences(config.kindPreferences)
  let scored = scoreCandidates(candidates, { kindPreferences })

  // Step 4b: Apply minScore filter from config (on runtime finalScore)
  const minScore = config.minScore ?? 0
  if (minScore > 0) {
    scored = scored.filter((s) => s.breakdown.finalScore >= minScore)
  }

  // Step 5: Trim to top N before AI
  const maxItems = config.maxItems ?? 50
  const finalCandidates = trimTopN(scored, maxItems)

  if (finalCandidates.length === 0) {
    await persistResults(date, dayLabel, [], "评分后无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 6: Group candidates by category (fallback approach)
  const topics = fallbackCategoryGrouping(finalCandidates)

  // Step 7: Persist
  try {
    await persistResults(date, dayLabel, topics, errorSteps.length > 0 ? "部分步骤失败" : undefined, errorSteps)
  } catch {
    errorSteps.push("persist")
  }

  return { date, topicCount: topics.length, errorSteps }
}
