import { prisma } from "@/lib/prisma"
import type { Item, Tweet, DailyReportConfig } from "@prisma/client"
import type { AiClient } from "@/src/ai/types"
import { formatUtcDate, formatUtcDayLabel } from "@/lib/date-utils"
import {
  buildTopicClusteringPrompt,
  parseTopicClusteringResult,
  buildTopicSummaryPrompt,
  parseTopicSummaryResult,
  buildFilterPrompt,
  parseFilterResult,
  type TopicClusterItem,
} from "@/src/ai/prompts-reports"

const SUMMARY_TRUNCATE_LENGTH = 500
const PARALLEL_CONCURRENCY = 3

export interface DailyGenerateResult {
  date: string
  topicCount: number
  errorSteps: string[]
}

// ============================================================
// Pipeline Steps
// ============================================================

/** Step 1: Collect items and tweets from the past 24 hours */
async function collectData(now: Date) {
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [items, tweets] = await Promise.all([
    prisma.item.findMany({
      where: { publishedAt: { gte: start, lte: now } },
      orderBy: { score: "desc" },
    }),
    prisma.tweet.findMany({
      where: {
        publishedAt: { gte: start, lte: now },
        tab: { in: ["home", "lists"] },
      },
    }),
  ])

  return { items, tweets }
}

/** Step 2: Filter by pack, keyword blacklist and min score */
async function filterContent(
  items: Item[],
  tweets: Tweet[],
  config: DailyReportConfig
): Promise<{ filteredItems: Item[]; filteredTweets: Tweet[] }> {
  const { keywordBlacklist, minScore } = config

  // Pack filtering: if packs specified, only include items from enabled sources in those packs
  let packFilteredItems = items
  if (config.packs.length > 0) {
    const packSources = await prisma.source.findMany({
      where: { packId: { in: config.packs }, enabled: true },
      select: { id: true },
    })
    if (packSources.length === 0) {
      console.warn(`[daily-report] packs ${config.packs.join(", ")} 下无已启用的数据源，所有条目将被过滤`)
    }
    const sourceIdSet = new Set(packSources.map((s) => s.id))
    packFilteredItems = items.filter((item) => sourceIdSet.has(item.sourceId))
  }

  const matchesBlacklist = (text: string): boolean => {
    if (!keywordBlacklist.length) return false
    return keywordBlacklist.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))
  }

  const filteredItems = packFilteredItems.filter(
    (item) => (item.score ?? 0) >= minScore && !matchesBlacklist(item.title + " " + (item.summary ?? ""))
  )
  const filteredTweets = tweets.filter(
    (tweet) => !matchesBlacklist((tweet.text ?? "") + " " + (tweet.authorHandle ?? ""))
  )

  return { filteredItems, filteredTweets }
}

/** Step 2b: Optional AI pre-filter */
async function aiFilter(
  filteredItems: Item[],
  filteredTweets: Tweet[],
  config: DailyReportConfig,
  aiClient: AiClient
): Promise<{ items: Item[]; tweets: Tweet[] }> {
  if (!config.filterPrompt) return { items: filteredItems, tweets: filteredTweets }

  try {
    const allContent: TopicClusterItem[] = [
      ...filteredItems.map((item, i) => ({
        title: item.title,
        summary: (item.summary ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
        type: "item" as const,
        index: i,
      })),
      ...filteredTweets.map((tweet, i) => ({
        title: `@${tweet.authorHandle}`,
        summary: (tweet.text ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
        type: "tweet" as const,
        index: filteredItems.length + i,
      })),
    ]

    const prompt = buildFilterPrompt(allContent, config.filterPrompt)
    const result = await aiClient.generateText(prompt)
    const { keep } = parseFilterResult(result)

    const keptItems = filteredItems.filter((_, i) => keep.includes(i))
    const keptTweets = filteredTweets.filter((_, i) => keep.includes(filteredItems.length + i))
    return { items: keptItems, tweets: keptTweets }
  } catch {
    // AI filter failure → pass all through
    return { items: filteredItems, tweets: filteredTweets }
  }
}

/** Step 3: AI topic clustering */
async function topicClustering(
  items: Item[],
  tweets: Tweet[],
  aiClient: AiClient,
  config: DailyReportConfig
) {
  const contentList: TopicClusterItem[] = [
    ...items.map((item, i) => ({
      title: item.title,
      summary: (item.summary ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
      type: "item" as const,
      index: i,
    })),
    ...tweets.map((tweet, i) => ({
      title: `@${tweet.authorHandle}`,
      summary: (tweet.text ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
      type: "tweet" as const,
      index: items.length + i,
    })),
  ]

  const prompt = buildTopicClusteringPrompt(contentList, config.topicPrompt)
  const result = await aiClient.generateText(prompt)
  return parseTopicClusteringResult(result)
}

/** Step 4a: Generate summary for each topic (parallel) */
async function generateTopicSummaries(
  clusteringResult: ReturnType<typeof parseTopicClusteringResult>,
  items: Item[],
  tweets: Tweet[],
  aiClient: AiClient,
  config: DailyReportConfig
) {
  const { topics } = clusteringResult

  const results: { title: string; summary: string; itemIds: string[]; tweetIds: string[] }[] = []
  for (let i = 0; i < topics.length; i += PARALLEL_CONCURRENCY) {
    const batch = topics.slice(i, i + PARALLEL_CONCURRENCY)
    const batchResults = await Promise.allSettled(
      batch.map(async (topic) => {
        const topicItems = topic.itemIndexes
          .filter((idx) => idx < items.length)
          .map((idx) => items[idx])
        const topicTweets = topic.tweetIndexes
          .filter((idx) => idx >= items.length)
          .map((idx) => tweets[idx - items.length])

        const contents = [
          ...topicItems.map((item) => ({
            title: item.title,
            summary: (item.summary ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
            type: "item" as const,
          })),
          ...topicTweets.map((tweet) => ({
            title: `@${tweet.authorHandle}`,
            summary: (tweet.text ?? "").slice(0, SUMMARY_TRUNCATE_LENGTH),
            type: "tweet" as const,
          })),
        ]

        if (contents.length === 0) return null

        const prompt = buildTopicSummaryPrompt(topic.title, contents, config.topicSummaryPrompt)
        const result = await aiClient.generateText(prompt)
        const parsed = parseTopicSummaryResult(result)

        return {
          title: topic.title,
          summary: parsed.summary,
          itemIds: topicItems.map((item) => item.id),
          tweetIds: topicTweets.map((tweet) => tweet.id),
        }
      })
    )

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value)
      }
    }
  }

  return results
}

/** Step 5: Persist results */
async function persistResults(
  date: string,
  dayLabel: string,
  topics: { title: string; summary: string; itemIds: string[]; tweetIds: string[] }[],
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

    // Create new topics
    if (topics.length > 0) {
      await tx.digestTopic.createMany({
        data: topics.map((topic, index) => ({
          dailyId: overview.id,
          order: index,
          title: topic.title,
          summary: topic.summary,
          itemIds: topic.itemIds,
          tweetIds: topic.tweetIds,
        })),
      })
    }

    return overview
  })
}

// ============================================================
// Fallback: Category-based grouping when AI clustering fails
// ============================================================

function fallbackCategoryGrouping(items: Item[]): { title: string; summary: string; itemIds: string[]; tweetIds: string[] }[] {
  const groups = new Map<string, Item[]>()

  for (const item of items) {
    const categories = item.categories ?? []
    const category = categories[0] ?? "其他"
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)!.push(item)
  }

  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    title: category,
    summary: groupItems[0].summary ?? "",
    itemIds: groupItems.map((item) => item.id),
    tweetIds: [],
  }))
}

// ============================================================
// Main Pipeline
// ============================================================

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

  // Step 1: Collect data
  let items: Item[]
  let tweets: Tweet[]
  try {
    const result = await collectData(now)
    items = result.items
    tweets = result.tweets
  } catch {
    errorSteps.push("dataCollection")
    await persistResults(date, dayLabel, [], "数据收集失败", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Apply maxItems limit
  items = items.slice(0, config.maxItems ?? 50)

  // Step 2: Filter
  const { filteredItems, filteredTweets } = await filterContent(items, tweets, config)

  // Step 2b: Optional AI filter
  let finalItems = filteredItems
  let finalTweets = filteredTweets
  if (config.filterPrompt) {
    const aiResult = await aiFilter(filteredItems, filteredTweets, config, aiClient)
    finalItems = aiResult.items
    finalTweets = aiResult.tweets
  }

  if (finalItems.length === 0 && finalTweets.length === 0) {
    await persistResults(date, dayLabel, [], "过去24小时无内容", errorSteps)
    return { date, topicCount: 0, errorSteps }
  }

  // Step 3: Topic clustering
  let topics: { title: string; summary: string; itemIds: string[]; tweetIds: string[] }[] = []
  try {
    const clusteringResult = await topicClustering(finalItems, finalTweets, aiClient, config)

    // Step 4a: Topic summaries
    try {
      topics = await generateTopicSummaries(clusteringResult, finalItems, finalTweets, aiClient, config)
    } catch {
      errorSteps.push("topicSummary")
      // Fallback: use clustering titles with first item summary
      topics = clusteringResult.topics.map((topic) => ({
        title: topic.title,
        summary: topic.itemIndexes[0] !== undefined
          ? (finalItems[topic.itemIndexes[0]]?.summary ?? "")
          : "",
        itemIds: topic.itemIndexes.filter((i) => i < finalItems.length).map((i) => finalItems[i].id),
        tweetIds: topic.tweetIndexes
          .filter((i) => i >= finalItems.length)
          .map((i) => finalTweets[i - finalItems.length].id),
      }))
    }
  } catch {
    errorSteps.push("topicClustering")
    // Fallback: group by categories
    topics = fallbackCategoryGrouping(finalItems)
  }

  // Step 4b: Persist
  try {
    await persistResults(date, dayLabel, topics, errorSteps.length > 0 ? "部分步骤失败" : undefined, errorSteps)
  } catch {
    errorSteps.push("persist")
  }

  return { date, topicCount: topics.length, errorSteps }
}
