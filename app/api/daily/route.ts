import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { success } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")

  // Find daily overview by date or latest
  const overview = await prisma.dailyOverview.findFirst({
    where: date ? { date } : undefined,
    orderBy: { date: "desc" },
    include: {
      topics: { orderBy: { order: "asc" } },
    },
  })

  if (!overview) {
    return success({
      date: date ?? null,
      dayLabel: null,
      topicCount: 0,
      topics: [],
      referencedItems: [],
      referencedTweets: [],
    })
  }

  // Collect all referenced IDs from topics
  const itemIds = new Set<string>()
  const tweetIds = new Set<string>()
  for (const topic of overview.topics) {
    for (const id of topic.itemIds) itemIds.add(id)
    for (const id of topic.tweetIds) tweetIds.add(id)
  }

  // Fetch referenced items and tweets in parallel
  const [referencedItems, referencedTweets] = await Promise.all([
    itemIds.size > 0
      ? prisma.item.findMany({
          where: { id: { in: Array.from(itemIds) } },
        })
      : [],
    tweetIds.size > 0
      ? prisma.tweet.findMany({
          where: { id: { in: Array.from(tweetIds) } },
        })
      : [],
  ])

  return success({
    date: overview.date,
    dayLabel: overview.dayLabel,
    topicCount: overview.topicCount,
    errorMessage: overview.errorMessage,
    errorSteps: overview.errorSteps,
    topics: overview.topics.map((t) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      summary: t.summary,
      itemIds: t.itemIds,
      tweetIds: t.tweetIds,
    })),
    referencedItems: referencedItems.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      summary: item.summary,
    })),
    referencedTweets: referencedTweets.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorHandle: tweet.authorHandle,
      tweetUrl: tweet.url,
    })),
  })
}
