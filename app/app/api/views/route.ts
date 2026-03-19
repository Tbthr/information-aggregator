import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { CUSTOM_VIEWS } from "@/lib/mock-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const startTime = Date.now()
  const views = await prisma.customView.findMany({
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  const data =
    views.length > 0
      ? views.map((view) => ({
          id: view.id,
          name: view.name,
          icon: view.icon,
          description: view.description,
          itemCount: view._count.items,
        }))
      : CUSTOM_VIEWS.map((view) => ({
          id: view.id,
          name: view.name,
          icon: view.icon,
          description: view.description,
          itemCount: view.articles.length,
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
}
