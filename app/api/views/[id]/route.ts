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

    // Get custom view with pack associations
    const view = await prisma.customView.findUnique({
      where: { id },
      include: {
        customViewPacks: {
          include: {
            pack: {
              include: {
                sources: {
                  where: { enabled: true },
                },
              },
            },
          },
        },
      },
    })

    if (!view) {
      return NextResponse.json(
        { success: false, error: "Custom view not found" },
        { status: 404 }
      )
    }

    // Extract source IDs
    const sourceIds = view.customViewPacks.flatMap((p: { pack: { sources: Array<{ id: string }> } }) =>
      p.pack.sources.map((s: { id: string }) => s.id)
    )

    // Parse filter JSON with bounds validation
    let filters: Record<string, unknown> = {}
    try {
      filters = view.filterJson ? JSON.parse(view.filterJson) : {}
    } catch {
      // Malformed filterJson in DB, use defaults
    }
    const days = Math.max(1, Math.min(365, Number(filters.days) || 7))
    const minScore = Math.max(0, Math.min(10, Number(filters.minScore) || 0))
    const limit = Math.max(1, Math.min(200, Number(filters.limit) || 50))

    // Calculate date threshold
    const dateThreshold = utcDaysAgo(days)

    // Query items from all sources
    const items = await prisma.item.findMany({
      where: {
        sourceId: { in: sourceIds },
        fetchedAt: { gte: dateThreshold },
      },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            kind: true,
          },
        },
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
        items,
        total: items.length,
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
