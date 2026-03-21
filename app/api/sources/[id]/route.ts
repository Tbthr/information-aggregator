import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type SourceUpdateInput = Prisma.SourceUpdateInput

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Helper to find source by id
async function findSourceById(id: string) {
  return prisma.source.findUnique({
    where: { id },
  })
}

// Zod schema for Source update
const sourceUpdateSchema = z.object({
  type: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  packId: z.string().nullable().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  const parsed = sourceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid source data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    // Find the source by id
    const existingSource = await findSourceById(id)
    if (!existingSource) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      )
    }

    // Validate packId exists if provided
    if (parsed.data.packId !== undefined && parsed.data.packId !== null) {
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

    // Build update data, only including defined fields
    const updateData: Prisma.SourceUpdateInput = {}

    if (parsed.data.type !== undefined) updateData.type = parsed.data.type
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.url !== undefined) updateData.url = parsed.data.url
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description === null ? { set: null } : parsed.data.description
    }
    if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled
    if (parsed.data.packId !== undefined) {
      updateData.pack = parsed.data.packId
        ? { connect: { id: parsed.data.packId } }
        : { disconnect: true }
    }

    const source = await prisma.source.update({
      where: { id: existingSource.id }, // Always use the actual id for update
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: source,
    })
  } catch (error) {
    console.error("Error updating source:", error)

    // Handle foreign key constraint (P2003 - packId not found)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { success: false, error: "Pack not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to update source" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    // Find the source by id
    const existingSource = await findSourceById(id)
    if (!existingSource) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      )
    }

    await prisma.source.delete({
      where: { id: existingSource.id }, // Always use the actual id for delete
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Error deleting source:", error)

    return NextResponse.json(
      { success: false, error: "Failed to delete source" },
      { status: 500 }
    )
  }
}
