import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, startTimer, timing, handlePrismaError, ParseError } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Pack creation
const packCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const startTime = startTimer()

    const [packs, sourceCounts, itemStats, allSources] = await Promise.all([
      prisma.pack.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.source.groupBy({
        by: ["packId"],
        _count: { _all: true },
        where: { packId: { not: null } },
      }),
      prisma.item.groupBy({
        by: ["sourceId"],
        _count: { _all: true },
        _max: { fetchedAt: true },
      }),
      prisma.source.findMany({
        select: { id: true, packId: true },
      }),
    ])

    const sourceCountByPack = new Map(
      sourceCounts.map((row) => [row.packId ?? "", row._count._all])
    )

    // Build sourceId -> packId lookup
    const sourcePackMap = new Map(allSources.map((s) => [s.id, s.packId ?? ""]))

    // Aggregate item stats per packId via sourceId
    const itemStatsByPack = new Map<string, { itemCount: number; latestItem: string | null }>()
    for (const row of itemStats) {
      const packId = sourcePackMap.get(row.sourceId) ?? ""
      const existing = itemStatsByPack.get(packId) ?? { itemCount: 0, latestItem: null as string | null }
      existing.itemCount += row._count._all
      const rowLatest = row._max.fetchedAt?.toISOString() ?? null
      if (rowLatest && (!existing.latestItem || rowLatest > existing.latestItem)) {
        existing.latestItem = rowLatest
      }
      itemStatsByPack.set(packId, existing)
    }

    const data = packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description ?? null,
      sourceCount: sourceCountByPack.get(pack.id) ?? 0,
      itemCount: itemStatsByPack.get(pack.id)?.itemCount ?? 0,
      latestItem: itemStatsByPack.get(pack.id)?.latestItem ?? null,
    }))

    return success(
      { packs: data },
      { timing: timing(startTime) }
    )
  } catch (err) {
    console.error("Error in /api/packs:", err)
    return error("Failed to load packs")
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await parseBody(request)
  } catch (e) {
    if (e instanceof ParseError) return error(e.message, e.status)
    throw e
  }

  const validated = validateBody(body, packCreateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    const pack = await prisma.pack.create({
      data: {
        id: parsedData.id,
        name: parsedData.name,
        description: parsedData.description,
      },
    })

    return success(pack)
  } catch (err) {
    console.error("Error creating pack:", err)

    const prismaErr = handlePrismaError(err, {
      p2002: "Pack with this ID already exists",
    })
    if (prismaErr) return prismaErr

    return error("Failed to create pack")
  }
}
