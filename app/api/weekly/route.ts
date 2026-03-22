import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { success } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const week = searchParams.get("week")

  // Find weekly report by week number or latest
  const report = await prisma.weeklyReport.findFirst({
    where: week ? { weekNumber: week } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      picks: { orderBy: { order: "asc" } },
    },
  })

  if (!report) {
    return success({
      weekNumber: week ?? null,
      editorial: null,
      picks: [],
      referencedItems: [],
    })
  }

  // Collect item IDs from picks and fetch referenced items
  const itemIdSet = new Set(report.picks.map((p) => p.itemId))
  const referencedItems =
    itemIdSet.size > 0
      ? await prisma.item.findMany({
          where: { id: { in: Array.from(itemIdSet) } },
          select: { id: true, title: true, url: true, score: true, summary: true },
        })
      : []

  return success({
    weekNumber: report.weekNumber,
    editorial: report.editorial,
    errorMessage: report.errorMessage,
    errorSteps: report.errorSteps,
    picks: report.picks.map((p) => ({
      id: p.id,
      order: p.order,
      itemId: p.itemId,
      reason: p.reason,
    })),
    referencedItems: referencedItems.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      score: item.score,
      summary: item.summary,
    })),
  })
}
