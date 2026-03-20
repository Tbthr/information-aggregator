import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for CustomView creation
const customViewCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  description: z.string().nullable().optional(),
  filterJson: z.string().nullable().optional(),
  packIds: z.array(z.string()).default([]),
})

export async function GET() {
  try {
    const views = await prisma.customView.findMany({
      include: {
        packs: {
          include: {
            pack: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: { views },
    })
  } catch (error) {
    console.error("Error in /api/custom-views:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load custom views" },
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

  const parsed = customViewCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid custom view data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const view = await prisma.customView.create({
      data: {
        id: parsed.data.id,
        name: parsed.data.name,
        icon: parsed.data.icon,
        description: parsed.data.description,
        filterJson: parsed.data.filterJson,
        packs: {
          create: parsed.data.packIds.map((packId) => ({ packId })),
        },
      },
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
    console.error("Error creating custom view:", error)

    // Handle duplicate ID (P2002 - unique constraint violation)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Custom view with this ID already exists" },
        { status: 409 }
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
      { success: false, error: "Failed to create custom view" },
      { status: 500 }
    )
  }
}
