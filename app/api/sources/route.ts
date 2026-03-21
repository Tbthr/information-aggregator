import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { loadAllPacksFromDb } from "../../../src/config/load-pack-prisma"

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
    const startTime = Date.now()
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

    return NextResponse.json({
      success: true,
      data: {
        sources: allSources,
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

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  const parsed = sourceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid source data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    // Validate packId exists if provided
    if (parsed.data.packId) {
      const pack = await prisma.pack.findUnique({
        where: { id: parsed.data.packId },
      })

      if (!pack) {
        return NextResponse.json(
          { success: false, error: "Pack not found" },
          { status: 404 }
        )
      }
    }

    const source = await prisma.source.create({
      data: {
        ...(parsed.data.id && { id: parsed.data.id }),
        type: parsed.data.type,
        name: parsed.data.name,
        url: parsed.data.url,
        description: parsed.data.description,
        enabled: parsed.data.enabled ?? true,
        packId: parsed.data.packId,
      },
    })

    return NextResponse.json({
      success: true,
      data: source,
    })
  } catch (error) {
    console.error("Error creating source:", error)

    // Handle duplicate ID (P2002 - unique constraint violation)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Source with this ID already exists" },
        { status: 409 }
      )
    }

    // Handle foreign key constraint (P2003 - packId not found)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { success: false, error: "Pack not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to create source", details: String(error) },
      { status: 500 }
    )
  }
}
