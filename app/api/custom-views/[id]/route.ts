import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for CustomView update
const customViewUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  filterJson: z.string().nullable().optional(),
  packIds: z.array(z.string()).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const view = await prisma.customView.findUnique({
      where: { id },
      include: {
        packs: {
          include: {
            pack: {
              include: {
                sources: true,
              },
            },
          },
        },
      },
    })

    if (!view) {
      return NextResponse.json(
        { success: false, error: "Custom view not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: view,
    })
  } catch (error) {
    console.error("Error fetching custom view:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load custom view" },
      { status: 500 }
    )
  }
}

export async function PUT(
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

  const parsed = customViewUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid custom view data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    // Build update data conditionally
    const updateData: Prisma.CustomViewUpdateInput = {}

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name
    }
    if (parsed.data.icon !== undefined) {
      updateData.icon = parsed.data.icon
    }
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description
    }
    if (parsed.data.filterJson !== undefined) {
      updateData.filterJson = parsed.data.filterJson
    }
    if (parsed.data.packIds !== undefined) {
      updateData.packs = {
        deleteMany: {},
        create: parsed.data.packIds.map((packId) => ({ packId })),
      }
    }

    const view = await prisma.customView.update({
      where: { id },
      data: updateData,
      include: {
        packs: {
          include: {
            pack: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: view,
    })
  } catch (error) {
    console.error("Error updating custom view:", error)

    // Handle record not found (P2025)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Custom view not found" },
        { status: 404 }
      )
    }

    // Handle foreign key constraint violation (P2003 - pack not found)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { success: false, error: "One or more pack IDs do not exist" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to update custom view" },
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
    await prisma.customView.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Error deleting custom view:", error)

    // Handle record not found (P2025)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Custom view not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to delete custom view" },
      { status: 500 }
    )
  }
}
