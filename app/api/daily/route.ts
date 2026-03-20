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

    const overview = await prisma.dailyOverview.findFirst({
      orderBy: { date: "desc" },
    })

    if (!overview) {
      // 无日报数据时，返回空数据（不是 mock）
      const items = await prisma.item.findMany({
        orderBy: [{ score: "desc" }, { fetchedAt: "desc" }],
        take: 6,
      })

      return NextResponse.json({
        success: true,
        data: {
          overview: null,
          articles: items.map(toArticle),
          newsFlashes: [],
        },
        meta: {
          timing: {
            generatedAt: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
          },
        },
      })
    }

    // 优化后：并行查询 items 和 newsFlashes
    const [items, newsFlashes] = await Promise.all([
      prisma.item.findMany({
        where: { id: { in: overview.itemIds } },
      }),
      prisma.newsFlash.findMany({
        where: { dailyDate: overview.date },
        orderBy: [{ createdAt: "desc" }, { time: "desc" }],
        take: 12,
      }),
    ])

    const itemMap = new Map(items.map((i) => [i.id, i]))
    const articles = overview.itemIds
      .map((id) => itemMap.get(id))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .map(toArticle)

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          date: overview.date,
          summary: overview.summary,
        },
        articles,
        newsFlashes: newsFlashes.map((f) => ({
          id: f.id,
          time: f.time,
          text: f.text,
        })),
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/daily:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load daily data" },
      { status: 500 }
    )
  }
}
