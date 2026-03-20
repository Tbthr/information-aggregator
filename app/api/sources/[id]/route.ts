import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Source update
const sourceUpdateSchema = z.object({
  type: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  url: z.string().nullable().optional(),
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

    const source = await prisma.source.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json({
      success: true,
      data: source,
    })
  } catch (error) {
    console.error("Error updating source:", error)

    // Handle record not found (P2025)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
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
    await prisma.source.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Error deleting source:", error)

    // Handle record not found (P2025)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to delete source" },
      { status: 500 }
    )
  }
}
