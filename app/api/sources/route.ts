import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { loadAllPacksFromDb } from "../../../src/config/load-pack-prisma"
import { generateSourceId } from "../../../src/config/source-id"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Source creation
const sourceCreateSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  name: z.string().min(1),
  url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  packId: z.string().nullable().optional(),
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
        id: parsed.data.id,
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
      { success: false, error: "Failed to create source" },
      { status: 500 }
    )
  }
}
