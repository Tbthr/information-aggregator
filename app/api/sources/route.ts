import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { loadAllPacksFromDb } from "../../../src/config/load-pack-prisma"
import { success, error, parseBody, validateBody, startTimer, timing, handlePrismaError, ParseError } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Source creation (id is optional - Prisma will generate CUID for id)
const sourceCreateSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  name: z.string().min(1),
  url: z.string().min(1),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  packId: z.string().min(1),
})

export async function GET() {
  try {
    const startTime = startTimer()
    const [packs, persistedSources] = await Promise.all([
      loadAllPacksFromDb(),
      prisma.source.findMany({
        orderBy: [{ packId: "asc" }, { name: "asc" }],
      }),
    ])

    // Build lookup map by (packId, url) - the unique constraint
    const persistedByKey = new Map(
      persistedSources
        .filter((s) => s.packId && s.url)
        .map((source) => [`${source.packId}:${source.url}`, source])
    )

    const configSources = packs.flatMap((pack) =>
      pack.sources.map((source) => {
        const key = `${pack.id}:${source.url}`
        const persisted = persistedByKey.get(key)
        return {
          id: persisted?.id ?? null, // Use persisted ID or null (will be generated on creation)
          type: persisted?.type ?? source.type,
          name: persisted?.name ?? source.description ?? source.url,
          url: persisted?.url ?? source.url,
          description: persisted?.description ?? source.description ?? null,
          enabled: persisted?.enabled ?? source.enabled !== false,
          packId: persisted?.packId ?? pack.id,
        }
      })
    )

    // Track (packId, url) combinations from config sources
    const seenKeys = new Set(configSources.map((s) => `${s.packId}:${s.url}`))

    // Sources that exist in DB but not in config
    const orphanSources = persistedSources
      .filter((source) => source.packId && source.url && !seenKeys.has(`${source.packId}:${source.url}`))
      .map((source) => ({
        id: source.id,
        type: source.type,
        name: source.name,
        url: source.url,
        description: source.description,
        enabled: source.enabled,
        packId: source.packId,
      }))

    const allSources = [...configSources, ...orphanSources]

    return success(
      { sources: allSources },
      { timing: timing(startTime) }
    )
  } catch (err) {
    console.error("Error in /api/sources:", err)
    return error("Failed to load sources")
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

  const validated = validateBody(body, sourceCreateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    // Validate packId exists if provided
    if (parsedData.packId) {
      const pack = await prisma.pack.findUnique({
        where: { id: parsedData.packId },
      })

      if (!pack) {
        return error("Pack not found", 404)
      }
    }

    const source = await prisma.source.create({
      data: {
        ...(parsedData.id && { id: parsedData.id }),
        type: parsedData.type,
        name: parsedData.name,
        url: parsedData.url,
        description: parsedData.description,
        enabled: parsedData.enabled ?? true,
        packId: parsedData.packId,
      },
    })

    return success(source)
  } catch (err) {
    console.error("Error creating source:", err)

    const prismaErr = handlePrismaError(err, {
      p2002: "Source with this ID already exists",
      p2003: "Pack not found",
    })
    if (prismaErr) return prismaErr

    return error("Failed to create source", 500, String(err))
  }
}
