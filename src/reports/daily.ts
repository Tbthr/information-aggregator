import { prisma } from "@/lib/prisma"
import type { Content, DailyReportConfig, DigestTopic } from "@prisma/client"
import type { ReportCandidate, ScoreBreakdown, SignalScores } from "@/src/types/index"
import type { AiClient } from "@/src/ai/types"
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
import { classifyProductivityDistance, type CandidateWithDistance } from "./classify-productivity"
import { classifyFreshness, type CandidateWithFreshness, type FreshnessTier } from "./classify-freshness"
import { filterByQuadrant } from "./filter-quadrant"
import { logDistribution } from "./log-distribution"
import { buildTopicSummaryPrompt, parseTopicSummaryResult } from "@/src/ai/prompts-reports"
import { loadTopicsByIds } from "@/src/config/load-pack-prisma"

export interface DailyGenerateResult {
  date: string
  topicCount: number
  errorSteps: string[]
}

// Re-export ScoredCandidate from scoring types for external consumers
export type ScoredCandidate = ScoringScoredCandidate

// Extended topic interface for in-memory pipeline (includes enrichment fields)
export interface DigestTopicWithEnrichment extends DigestTopic {
  freshnessTier?: FreshnessTier
  productivityDistance?: CandidateWithDistance["distance"]
}

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

/** Step 10: Generate topic summaries grouped by preset topics */
async function generateTopicSummariesByPresetTopics(
  scored: ScoredCandidate[],
  aiClient: AiClient,
  config: DailyReportConfig,
  candidatesWithDistance: CandidateWithDistance[],
  candidatesWithFreshness: CandidateWithFreshness[]
): Promise<DigestTopicWithEnrichment[]> {
  // Build lookup maps for distance and freshness by content id
  const distanceMap = new Map(candidatesWithDistance.map(c => [c.candidate.id, c.distance]))
  const freshnessMap = new Map(candidatesWithFreshness.map(c => [c.candidate.id, c.freshness]))

  // Load preset topics from DB
  const presetTopics = await loadTopicsByIds(config.topicIds)
  if (presetTopics.length === 0) {
    console.warn("[daily-report] no preset topics found, using empty grouping")
    return []
  }

  // Group candidates by preset topic id
  const candidatesByTopic = new Map<string, ScoredCandidate[]>()
  for (const candidate of scored) {
    for (const tid of candidate.topicIds ?? []) {
      if (config.topicIds.includes(tid)) {
        if (!candidatesByTopic.has(tid)) {
          candidatesByTopic.set(tid, [])
        }
        candidatesByTopic.get(tid)!.push(candidate)
        break // each candidate belongs to one preset topic
      }
    }
  }

  const topics: DigestTopicWithEnrichment[] = []

  for (const topic of presetTopics) {
    const topicCandidates = candidatesByTopic.get(topic.id) ?? []

    // Determine freshness tier and productivity distance for this topic
    // Uses the first matching candidate's classification (each candidate belongs to exactly one preset topic)
    const freshnessTier: FreshnessTier = topicCandidates.length > 0
      ? (freshnessMap.get(topicCandidates[0].id) ?? "趋势")
      : "趋势"
    const productivityDistance: CandidateWithDistance["distance"] = topicCandidates.length > 0
      ? (distanceMap.get(topicCandidates[0].id) ?? "中")
      : "中"

    if (topicCandidates.length === 0) {
      // No candidates for this topic, skip AI call
      continue
    }

    // Build content list for prompt
    const contents = topicCandidates.map(c => ({
      title: c.title ?? "",
      summary: c.summary ?? "",
      type: c.kind,
    }))

    // Build prompt and call AI
    const promptText = buildTopicSummaryPrompt(
      topic.name,
      contents,
      config.topicSummaryPrompt ?? ""
    )

    let summaryText: string
    try {
      const result = await aiClient.generateText(promptText)
      const parsed = parseTopicSummaryResult(result)
      summaryText = parsed.summary
    } catch {
      // Fallback: concatenate summaries
      summaryText = topicCandidates.map(c => c.summary).join(" ")
    }

    const topicWithEnrichment: DigestTopicWithEnrichment = {
      id: "",
      dailyId: "",
      order: topics.length,
      title: topic.name,
      summary: summaryText,
      contentIds: topicCandidates.map(c => c.id),
      createdAt: new Date(),
      freshnessTier,
      productivityDistance,
    }

    topics.push(topicWithEnrichment)
  }

  return topics
}

/** Step 3: Persist results */
async function persistResults(
  date: string,
  dayLabel: string,
  topics: DigestTopicWithEnrichment[],
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
// Main Pipeline
// ============================================================

/**
 * Generates a daily report using the quadrant-aware pipeline.
 *
 * Pipeline order:
 * 1. Collect items + tweets from DB (Beijing day range)
 * 2. Filter by topic/excludeRules
 * 3. Map to ReportCandidate[]
 * 4. Classify productivity distance
 * 5. Classify freshness
 * 6. Quadrant filter (远+热点 → 丢弃)
 * 7. Score candidates
 * 8. Productivity bonus (inline)
 * 9. Trim to top N
 * 10. Generate topic summaries by preset topics
 * 11. Log distribution
 * 12. Persist results
 */
export async function generateDailyReport(
  now: Date,
  aiClient: AiClient
): Promise<DailyGenerateResult> {
  const date = formatUtcDate(now)
  const dayLabel = formatUtcDayLabel(now)
  const errorSteps: string[] = []

  // Load config
  let config = await prisma.dailyReportConfig.findUnique({ where: { id: "default" } })
  if (!config) {
    // This fallback should not happen in production since DB has defaults
    config = await prisma.dailyReportConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        filterPrompt: "",
        topicPrompt: "",
        topicSummaryPrompt: "",
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

  // Step 4: Classify productivity distance
  const candidatesWithDistance = classifyProductivityDistance(candidates)

  // Step 5: Classify freshness
  const candidatesWithFreshness = classifyFreshness(candidates)

  // Step 6: Quadrant filter (远+热点 → 丢弃)
  const filteredByQuadrant = filterByQuadrant(candidatesWithDistance, candidatesWithFreshness)
  const filteredCandidates = filteredByQuadrant.map(c => c.candidate)

  if (filteredCandidates.length === 0) {
    await persistResults(date, dayLabel, [], "象限过滤后无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 7: Score all candidates
  const kindPreferences = parseKindPreferences(config.kindPreferences)
  let scored = scoreCandidates(filteredCandidates, { kindPreferences })

  // Step 8: Productivity bonus (inline)
  const distanceMap = new Map(
    candidatesWithDistance.map(c => [c.candidate.id, c.distance])
  )
  scored = scored.map(c => {
    const distance = distanceMap.get(c.id) ?? "中"
    const bonus = distance === "近" ? 1.3 : distance === "远" ? 0.8 : 1.0
    return {
      ...c,
      breakdown: {
        ...c.breakdown,
        finalScore: c.breakdown.finalScore * bonus
      }
    }
  })

  // Step 9: Trim to top N before AI
  const maxItems = config.maxItems ?? 50
  const trimmed = trimTopN(scored, maxItems)

  if (trimmed.length === 0) {
    await persistResults(date, dayLabel, [], "评分后无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 10: Generate topic summaries by preset topics
  let topics: DigestTopicWithEnrichment[]
  try {
    topics = await generateTopicSummariesByPresetTopics(
      trimmed,
      aiClient,
      config,
      candidatesWithDistance,
      candidatesWithFreshness
    )
  } catch {
    errorSteps.push("topicSummary")
    topics = []
  }

  // Step 11: Log distribution
  const allClassified = candidatesWithDistance.map((c, i) => ({
    ...c,
    ...candidatesWithFreshness[i],
  }))
  logDistribution(
    allClassified as (CandidateWithDistance & CandidateWithFreshness)[],
    filteredByQuadrant,
    topics as DigestTopic[]
  )

  // Step 12: Persist
  try {
    await persistResults(date, dayLabel, topics, errorSteps.length > 0 ? "部分步骤失败" : undefined, errorSteps)
  } catch {
    errorSteps.push("persist")
  }

  return { date, topicCount: topics.length, errorSteps }
}
