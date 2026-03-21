import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const startTime = Date.now()
    const views = await prisma.customView.findMany({
      include: {
        _count: {
          select: {
            customViewPacks: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    const data = views.map((view) => ({
      id: view.id,
      name: view.name,
      icon: view.icon,
      description: view.description,
      packCount: view._count.customViewPacks,
    }))

    return NextResponse.json({
      success: true,
      data: { views: data },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/views:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load views" },
      { status: 500 }
    )
  }
}
