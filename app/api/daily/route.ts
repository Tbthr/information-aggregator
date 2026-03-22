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
      picks: { orderBy: { order: "asc" } },
    },
  })

  if (!overview) {
    return success({
      date: date ?? null,
      dayLabel: null,
      topicCount: 0,
      topics: [],
      picks: [],
    })
  }

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
    picks: overview.picks.map((p) => ({
      id: p.id,
      order: p.order,
      itemId: p.itemId,
      tweetId: p.tweetId,
      reason: p.reason,
    })),
  })
}
