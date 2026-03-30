import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { utcDaysAgo } from "@/lib/date-utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const startTime = Date.now()

    // Get custom view with topic associations
    const view = await prisma.customView.findUnique({
      where: { id },
      include: {
        customViewTopics: true,
      },
    })

    if (!view) {
      return NextResponse.json(
        { success: false, error: "Custom view not found" },
        { status: 404 }
      )
    }

    // Extract topic IDs
    const topicIds = view.customViewTopics.map((cvt) => cvt.topicId)

    // Parse filter JSON with bounds validation
    let filters: Record<string, unknown> = {}
    try {
      filters = view.filterJson ? JSON.parse(view.filterJson) : {}
    } catch {
      // Malformed filterJson in DB, use defaults
    }
    const days = Math.max(1, Math.min(365, Number(filters.days) || 7))
    const limit = Math.max(1, Math.min(200, Number(filters.limit) || 50))

    // Calculate date threshold
    const dateThreshold = utcDaysAgo(days)

    // Query contents from all sources associated with topics
    // Note: This is a simplified implementation - full Topic-based filtering
    // would require joining through Source.defaultTopicIds
    const contents = await prisma.content.findMany({
      where: {
        topicIds: { hasSome: topicIds },
        fetchedAt: { gte: dateThreshold },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: {
        view: {
          id: view.id,
          name: view.name,
          icon: view.icon,
          description: view.description,
        },
        contents,
        total: contents.length,
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error(`Error in /api/views/${id}:`, error)
    return NextResponse.json(
      { success: false, error: "Failed to load view" },
      { status: 500 }
    )
  }
}
