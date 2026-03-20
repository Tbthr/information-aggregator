import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

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
        packs: {
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
    const sourceIds = view.packs.flatMap((p) =>
      p.pack.sources.map((s) => s.id)
    )

    // Parse filter JSON
    const filters = view.filterJson ? JSON.parse(view.filterJson) : {}
    const { days = 7, minScore = 0, limit = 50 } = filters

    // Calculate date threshold
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    // Query items from all sources
    const items = await prisma.item.findMany({
      where: {
        sourceId: { in: sourceIds },
        fetchedAt: { gte: dateThreshold },
        score: { gte: minScore },
      },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { score: "desc" },
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
