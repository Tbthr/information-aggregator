import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Pack update
const packUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  policyJson: z.string().nullable().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const pack = await prisma.pack.findUnique({
      where: { id },
      include: { sources: true },
    })

    if (!pack) {
      return NextResponse.json(
        { success: false, error: "Pack not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: pack,
    })
  } catch (error) {
    console.error("Error fetching pack:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load pack" },
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

  const parsed = packUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid pack data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const pack = await prisma.pack.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json({
      success: true,
      data: pack,
    })
  } catch (error) {
    console.error("Error updating pack:", error)

    // Handle record not found (P2025)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Pack not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to update pack" },
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
    await prisma.pack.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Error deleting pack:", error)

    // Handle record not found (P2025)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "Pack not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to delete pack" },
      { status: 500 }
    )
  }
}
