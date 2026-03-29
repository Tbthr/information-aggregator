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
      contents: [],
    })
  }

  // Collect content IDs from picks and fetch referenced content
  const contentIdSet = new Set(report.picks.map((p) => p.contentId).filter((id): id is string => !!id))
  const contents =
    contentIdSet.size > 0
      ? await prisma.content.findMany({
          where: { id: { in: Array.from(contentIdSet) } },
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
      contentId: p.contentId,
      reason: p.reason,
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
