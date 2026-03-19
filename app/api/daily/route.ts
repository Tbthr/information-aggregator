import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import {
  DAILY_OVERVIEW,
  NEWS_FLASHES,
  RECOMMENDED_ARTICLES,
  SPOTLIGHT_ARTICLES,
} from "@/lib/mock-data"

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
  category: string | null
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
    category: item.category ?? undefined,
    aiScore: item.score,
  }
}

export async function GET() {
  try {
    const startTime = Date.now()
    const [overview, items, flashes] = await Promise.all([
      prisma.dailyOverview.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.item.findMany({
        orderBy: [{ score: "desc" }, { fetchedAt: "desc" }],
        take: 6,
      }),
      prisma.newsFlash.findMany({
        orderBy: [{ createdAt: "desc" }, { time: "desc" }],
        take: 12,
      }),
    ])

    // If we have fewer than 6 items, use all mock data to avoid inconsistent fallback
    const hasEnoughItems = items.length >= 6
    const hasEnoughFlashes = flashes.length > 0

    const spotlight = hasEnoughItems ? items.slice(0, 2).map(toArticle) : []
    const recommended = hasEnoughItems ? items.slice(2).map(toArticle) : []

    return NextResponse.json({
      success: true,
      data: {
        overview: overview
          ? {
              date: overview.date,
              summary: overview.summary,
            }
          : DAILY_OVERVIEW,
        spotlightArticles: spotlight.length > 0 ? spotlight : SPOTLIGHT_ARTICLES,
        recommendedArticles: recommended.length > 0 ? recommended : RECOMMENDED_ARTICLES,
        newsFlashes: hasEnoughFlashes
          ? flashes.map((flash: { id: string; time: string; text: string }) => ({
              id: flash.id,
              time: flash.time,
              text: flash.text,
            }))
          : NEWS_FLASHES,
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
