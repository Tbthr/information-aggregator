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
      contents: [],
    })
  }

  // Collect all content IDs from topics
  const contentIdSet = new Set<string>()
  for (const topic of overview.topics) {
    for (const id of topic.contentIds) contentIdSet.add(id)
  }

  // Fetch referenced content
  const contents =
    contentIdSet.size > 0
      ? await prisma.content.findMany({
          where: { id: { in: Array.from(contentIdSet) } },
        })
      : []

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
      contentIds: t.contentIds,
    })),
    contents: contents.map((c) => ({
      id: c.id,
      kind: c.kind,
      sourceId: c.sourceId,
      title: c.title,
      body: c.body,
      url: c.url,
      authorLabel: c.authorLabel,
      publishedAt: c.publishedAt?.toISOString() ?? null,
      fetchedAt: c.fetchedAt.toISOString(),
      engagementScore: c.engagementScore,
      qualityScore: c.qualityScore,
      topicIds: c.topicIds,
      topicScoresJson: c.topicScoresJson,
      metadataJson: c.metadataJson,
    })),
  })
}
