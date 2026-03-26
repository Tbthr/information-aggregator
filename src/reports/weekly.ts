import { prisma } from "@/lib/prisma"
import type { Item, WeeklyReportConfig } from "@prisma/client"
import type { AiClient } from "@/src/ai/types"
import { utcWeekNumber, beijingWeekRange } from "@/lib/date-utils"
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
// Pipeline Steps
// ============================================================

/** Step 1: Collect data from daily reports */
async function collectData(config: WeeklyReportConfig) {
  const days = config.days ?? 7
  const dailyOverviews = await prisma.dailyOverview.findMany({
    orderBy: { date: "desc" },
    take: days,
    include: {
      topics: {
        orderBy: { order: "asc" },
      },
    },
  })

  // Collect all referenced item IDs and tweet IDs
  const itemIdSet = new Set<string>()
  const topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[] = []

  for (const daily of dailyOverviews) {
    for (const topic of daily.topics) {
      for (const id of topic.itemIds) itemIdSet.add(id)
      topicSummaries.push({
        date: daily.date,
        dayLabel: daily.dayLabel,
        title: topic.title,
        summary: topic.summary,
      })
    }
  }

  const items = itemIdSet.size > 0
    ? await prisma.item.findMany({ where: { id: { in: Array.from(itemIdSet) } } })
    : []

  return { items, topicSummaries }
}

/** Step 2: AI deep editorial */
async function generateEditorial(
  topicSummaries: { date: string; dayLabel: string; title: string; summary: string }[],
  items: Item[],
  aiClient: AiClient,
  config: WeeklyReportConfig
): Promise<string> {
  // Sort topic summaries by date ascending
  const sortedSummaries = [...topicSummaries].sort((a, b) => a.date.localeCompare(b.date))

  // Get top items by score for context
  const topItems = [...items]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      summary: (item.summary ?? "").slice(0, 500),
      score: item.score ?? 0,
    }))

  const prompt = buildEditorialPrompt(sortedSummaries, topItems, config.editorialPrompt ?? "")
  const result = await aiClient.generateText(prompt)
  const parsed = parseEditorialResult(result)
  return parsed.editorial
}

/** Step 3: Weekly picks + persist */
async function generateWeeklyPicks(
  items: Item[],
  aiClient: AiClient,
  config: WeeklyReportConfig
) {
  const pickCount = config.pickCount ?? 6
  const sortedItems = [...items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const picks: { itemId: string; reason: string }[] = []

  for (const item of sortedItems.slice(0, pickCount)) {
    try {
      const prompt = buildPickReasonPrompt(item.title, item.summary ?? "", config.pickReasonPrompt ?? "")
      const result = await aiClient.generateText(prompt)
      const parsed = parsePickReasonResult(result)
      picks.push({ itemId: item.id, reason: parsed.reason })
    } catch {
      picks.push({ itemId: item.id, reason: item.summary ?? "" })
    }
  }

  return picks
}

async function persistResults(
  weekNumber: string,
  editorial: string | null,
  picks: { itemId: string; reason: string }[],
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

    // Create new picks
    if (picks.length > 0) {
      await tx.weeklyPick.createMany({
        data: picks.map((pick, index) => ({
          weeklyId: report.id,
          order: index,
          itemId: pick.itemId,
          reason: pick.reason,
        })),
      })
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
  const data = await collectData(config)
  const { items, topicSummaries } = data

  if (items.length === 0) {
    await persistResults(weekNumber, "本周无引用文章", [], "无数据")
    return { weekNumber, pickCount: 0, errorSteps: [] }
  }

  // Step 2: Editorial
  let editorial: string | null = null
  try {
    editorial = await generateEditorial(topicSummaries, items, aiClient, config)
  } catch {
    errorSteps.push("editorial")
    // Fallback: concatenate topic summaries
    editorial = topicSummaries.map((t) => `【${t.title}】${t.summary}`).join("\n\n")
  }

  // Step 3: Weekly picks
  let picks: { itemId: string; reason: string }[] = []
  try {
    picks = await generateWeeklyPicks(items, aiClient, config)
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
