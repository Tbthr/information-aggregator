import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceIdsParam = searchParams.get("sourceIds")

    if (!sourceIdsParam) {
      return NextResponse.json(
        { success: false, error: "sourceIds is required" },
        { status: 400 }
      )
    }

    const sourceIds = sourceIdsParam.split(",").filter(Boolean)

    if (sourceIds.length === 0) {
      return NextResponse.json({ success: true, data: {} })
    }

    const configs = await prisma.authConfig.findMany({
      where: { sourceId: { in: sourceIds } },
      select: { sourceId: true },
    })

    const result: Record<string, { hasConfig: boolean }> = {}
    for (const id of sourceIds) {
      result[id] = { hasConfig: false }
    }
    for (const config of configs) {
      result[config.sourceId] = { hasConfig: true }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch auth configs" },
      { status: 500 }
    )
  }
}
