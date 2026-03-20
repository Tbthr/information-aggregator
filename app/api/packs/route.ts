import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Pack creation
const packCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  policyJson: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const startTime = Date.now()

    const [packs, sourceCounts, itemStats] = await Promise.all([
      prisma.pack.findMany({
        orderBy: { name: "asc" },
      }),
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
      sourceCount: sourceCountByPack.get(pack.id) ?? 0,
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

  const parsed = packCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid pack data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const pack = await prisma.pack.create({
      data: {
        id: parsed.data.id,
        name: parsed.data.name,
        description: parsed.data.description,
        policyJson: parsed.data.policyJson,
      },
    })

    return NextResponse.json({
      success: true,
      data: pack,
    })
  } catch (error) {
    console.error("Error creating pack:", error)

    // Handle duplicate ID (P2002 - unique constraint violation)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Pack with this ID already exists" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to create pack" },
      { status: 500 }
    )
  }
}
