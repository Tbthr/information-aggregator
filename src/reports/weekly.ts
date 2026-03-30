import { prisma } from "@/lib/prisma"
import type { Content, WeeklyReportConfig } from "@prisma/client"
import type { AiClient } from "@/src/ai/types"
import { utcWeekNumber, beijingWeekRange, formatUtcDate } from "@/lib/date-utils"
import {
  buildEditorialPrompt,
  parseEditorialResult,
  buildPickReasonPrompt,
  parsePickReasonResult,
} from "@/src/ai/prompts-reports"

export interface WeeklyGenerateResult {
  weekNumber: string
  pickCount: number
  errorSteps: string[]
}

// ============================================================
// Compatibility Notes
// ============================================================
//
// Weekly report reads from DailyOverview (which uses the new scoring pipeline).
// It does NOT directly read Content for data selection -- it consumes daily
// results via DigestTopic.contentIds to get the set of relevant Content IDs.
//
// Content records are fetched for enrichment context only (title, body).
// Sorting uses publishedAt (most recent first).
//
// Contract: DailyOverview -> DigestTopic.contentIds -> Content.id
// Weekly picks: WeeklyPick.contentId -> Content.id
// Integrity check F-05 verifies: every WeeklyPick.contentId appears in some
// DigestTopic.contentIds from the same time window.
// ============================================================

// ============================================================
// Pipeline Steps
// ============================================================

/** Step 1: Collect data from daily reports */
async function collectData(config: WeeklyReportConfig, weekStart: Date, weekEnd: Date) {
  const dailyOverviews = await prisma.dailyOverview.findMany({
    where: {
      date: {
        gte: formatUtcDate(weekStart),
        lte: formatUtcDate(weekEnd),
      },
    },
    orderBy: { date: "asc" },
    include: {
      topics: {
        orderBy: { order: "asc" },
      },
    },
  })

  // Collect all referenced content IDs from daily topics (the weekly-daily contract).
  // Weekly only consumes what daily produced -- it does not independently select Content.
  const contentIdSet = new Set<string>()
  const topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[] = []

  for (const daily of dailyOverviews) {
    for (const topic of daily.topics) {
      for (const id of topic.contentIds) contentIdSet.add(id)
      topicSummaries.push({
        date: daily.date,
        dayLabel: daily.dayLabel,
        title: topic.title,
        summary: topic.summary,
      })
    }
  }

  // Fetch Content records for enrichment context (title, body).
  const contents = contentIdSet.size > 0
    ? await prisma.content.findMany({ where: { id: { in: Array.from(contentIdSet) } } })
    : []

  return { contents, topicSummaries }
}

/** Step 2: AI deep editorial */
async function generateEditorial(
  topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[],
  contents: Content[],
  aiClient: AiClient,
  config: WeeklyReportConfig
): Promise<string> {
  // Sort topic summaries by date ascending
  const sortedSummaries = [...topicSummaries].sort((a, b) => a.date.localeCompare(b.date))

  // Get top contents by recency for editorial context.
  const topContents = [...contents]
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, 10)
    .map((content) => ({
      title: content.title ?? "",
      summary: (content.body ?? "").slice(0, 500),
    }))

  const prompt = buildEditorialPrompt(sortedSummaries, topContents, config.editorialPrompt ?? "")
  const result = await aiClient.generateText(prompt)
  const parsed = parseEditorialResult(result)
  return parsed.editorial
}

/** Step 3: Weekly picks + persist */
async function generateWeeklyPicks(
  contents: Content[],
  aiClient: AiClient,
  config: WeeklyReportConfig
) {
  const pickCount = config.pickCount ?? 6

  // Sort by recency. All contents come from daily topic contentIds
  // so the weekly-daily contract is maintained (verified by integrity check F-05).
  const sortedContents = [...contents].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
  const picks: { contentId: string; reason: string }[] = []

  for (const content of sortedContents.slice(0, pickCount)) {
    try {
      const prompt = buildPickReasonPrompt(content.title ?? "", content.body ?? "", config.pickReasonPrompt ?? "")
      const result = await aiClient.generateText(prompt)
      const parsed = parsePickReasonResult(result)
      picks.push({ contentId: content.id, reason: parsed.reason })
    } catch {
      picks.push({ contentId: content.id, reason: content.body ?? "" })
    }
  }

  return picks
}

async function persistResults(
  weekNumber: string,
  editorial: string | null,
  picks: { contentId: string; reason: string }[],
  errorMessage?: string,
  errorSteps?: string[]
) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.weeklyReport.upsert({
      where: { weekNumber },
      create: {
        weekNumber,
        editorial,
        errorMessage,
        errorSteps: errorSteps ?? [],
      },
      update: {
        editorial,
        errorMessage,
        errorSteps: errorSteps ?? [],
      },
    })

    // Delete old picks
    await tx.weeklyPick.deleteMany({ where: { weeklyId: report.id } })

    // Create new picks with contentId
    if (picks.length > 0) {
      for (let i = 0; i < picks.length; i++) {
        await tx.weeklyPick.create({
          data: {
            weeklyId: report.id,
            order: i,
            contentId: picks[i].contentId,
            reason: picks[i].reason,
          },
        })
      }
    }

    return report
  })
}

// ============================================================
// Main Pipeline
// ============================================================

export async function generateWeeklyReport(
  now: Date,
  aiClient: AiClient
): Promise<WeeklyGenerateResult> {
  const errorSteps: string[] = []

  // Calculate week number
  const weekRange = beijingWeekRange(now)
  const monday = weekRange.start
  const weekNumber = utcWeekNumber(monday)

  // Load config
  let config = await prisma.weeklyReportConfig.findUnique({ where: { id: "default" } })
  if (!config) {
    // Use upsert with all required fields - this should not happen normally since DB has defaults
    config = await prisma.weeklyReportConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        editorialPrompt: "",
        pickReasonPrompt: "",
      },
      update: {},
    })
  }

  // Step 1: Collect data
  const data = await collectData(config, monday, weekRange.end)
  const { contents, topicSummaries } = data

  if (contents.length === 0) {
    await persistResults(weekNumber, "本周无引用文章", [], "无数据")
    return { weekNumber, pickCount: 0, errorSteps: [] }
  }

  // Step 2: Editorial
  let editorial: string | null = null
  try {
    editorial = await generateEditorial(topicSummaries, contents, aiClient, config)
  } catch {
    errorSteps.push("editorial")
    // Fallback: concatenate topic summaries
    editorial = topicSummaries.map((t) => `【${t.title}】${t.summary}`).join("\n\n")
  }

  // Step 3: Weekly picks
  let picks: { contentId: string; reason: string }[] = []
  try {
    picks = await generateWeeklyPicks(contents, aiClient, config)
  } catch {
    errorSteps.push("pickReason")
  }

  // Persist
  try {
    await persistResults(
      weekNumber,
      editorial,
      picks,
      errorSteps.length > 0 ? "部分步骤失败" : undefined,
      errorSteps
    )
  } catch {
    errorSteps.push("persist")
  }

  return { weekNumber, pickCount: picks.length, errorSteps }
}
