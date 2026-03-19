import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { loadAllPacks } from "../../../../src/config/load-pack"
import { generateSourceId } from "../../../../src/config/source-id"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const startTime = Date.now()
    const [packs, persistedSources] = await Promise.all([
      loadAllPacks("config/packs"),
      prisma.source.findMany({
        orderBy: [{ packId: "asc" }, { name: "asc" }],
      }),
    ])

    const persistedById = new Map(persistedSources.map((source) => [source.id, source]))
    const configSources = packs.flatMap((pack) =>
      pack.sources.map((source) => {
        const id = generateSourceId(source.url)
        const persisted = persistedById.get(id)
        return {
          id,
          type: persisted?.type ?? source.type,
          name: persisted?.name ?? source.description ?? source.url,
          url: persisted?.url ?? source.url,
          description: persisted?.description ?? source.description ?? null,
          enabled: persisted?.enabled ?? source.enabled !== false,
          packId: persisted?.packId ?? pack.id,
        }
      })
    )

    const seen = new Set(configSources.map((source) => source.id))
    const fallbackPersisted = persistedSources
      .filter((source) => !seen.has(source.id))
      .map((source) => ({
        id: source.id,
        type: source.type,
        name: source.name,
        url: source.url,
        description: source.description,
        enabled: source.enabled,
        packId: source.packId,
      }))

    return NextResponse.json({
      success: true,
      data: {
        sources: [...configSources, ...fallbackPersisted],
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    })
  } catch (error) {
    console.error("Error in /api/sources:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load sources" },
      { status: 500 }
    )
  }
}
