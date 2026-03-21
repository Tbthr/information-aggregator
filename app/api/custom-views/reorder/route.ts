import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for reorder request
const reorderSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().min(1),
      order: z.int().min(0),
    })
  ),
})

export async function PUT(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body" },
      { status: 400 }
    )
  }

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid reorder data", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    // Update each view's order in a transaction
    await prisma.$transaction(
      parsed.data.orders.map((item) =>
        prisma.customView.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Error reordering custom views:", error)
    return NextResponse.json(
      { success: false, error: "Failed to reorder custom views" },
      { status: 500 }
    )
  }
}
