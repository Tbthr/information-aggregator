import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { loadAllPacks } from "../../../src/config/load-pack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const startTime = Date.now()
    const packs = await loadAllPacks("config/packs")

    const [sourceCounts, itemStats] = await Promise.all([
      prisma.source.groupBy({
        by: ["packId"],
        _count: { _all: true },
        where: { packId: { not: null } },
      }),
      prisma.item.groupBy({
        by: ["packId"],
        _count: { _all: true },
        _max: { fetchedAt: true },
        where: { packId: { not: null } },
      }),
    ])

    const sourceCountByPack = new Map(
      sourceCounts.map((row) => [row.packId ?? "", row._count._all])
    )
    const itemStatsByPack = new Map(
      itemStats.map((row) => [
        row.packId ?? "",
        {
          itemCount: row._count._all,
          latestItem: row._max.fetchedAt?.toISOString() ?? null,
        },
      ])
    )

    const data = packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description ?? null,
      sourceCount:
        sourceCountByPack.get(pack.id) ?? pack.sources.filter((source) => source.enabled !== false).length,
      itemCount: itemStatsByPack.get(pack.id)?.itemCount ?? 0,
      latestItem: itemStatsByPack.get(pack.id)?.latestItem ?? null,
    }))

    return NextResponse.json({
      success: true,
      data: { packs: data },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/packs:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load packs" },
      { status: 500 }
    )
  }
}
