import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function toArticle(item: {
  id: string
  title: string
  sourceName: string
  url: string
  publishedAt: Date | null
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
  score: number
}) {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName,
    sourceUrl: item.url,
    publishedAt: item.publishedAt?.toISOString() ?? "",
    summary: item.summary ?? "",
    bullets: item.bullets,
    content: item.content ?? "",
    imageUrl: item.imageUrl ?? undefined,
    category: item.categories[0] ?? undefined,
    aiScore: item.score,
  }
}

export async function GET() {
  try {
    const startTime = Date.now()

    const report = await prisma.weeklyReport.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        timelineEvents: {
          orderBy: { order: "asc" },
        },
      },
    })

    if (!report) {
      // 无周报数据时返回空
      return NextResponse.json({
        success: true,
        data: {
          hero: null,
          timelineEvents: [],
          deepDives: [],
        },
        meta: {
          timing: {
            generatedAt: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
          },
        },
      })
    }

    // 收集所有 timeline events 的 itemIds
    const allItemIds = report.timelineEvents.flatMap((e) => e.itemIds)
    const items = await prisma.item.findMany({
      where: { id: { in: allItemIds } },
    })
    const itemMap = new Map(items.map((i) => [i.id, i]))

    // 按评分排序获取 deep dives
    const sortedItems = items.sort((a, b) => b.score - a.score).slice(0, 5)
    const deepDives = sortedItems.map(toArticle)

    return NextResponse.json({
      success: true,
      data: {
        hero: {
          weekNumber: report.weekNumber,
          headline: report.headline,
          subheadline: report.subheadline ?? "",
          editorial: report.editorial ?? "",
        },
        timelineEvents: report.timelineEvents.map((e) => ({
          id: e.id,
          date: e.date,
          dayLabel: e.dayLabel,
          title: e.title,
          summary: e.summary,
          itemIds: e.itemIds,
        })),
        deepDives,
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/weekly:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load weekly data" },
      { status: 500 }
    )
  }
}
