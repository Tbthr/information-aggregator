import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, ParseError } from "@/lib/api-response"

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
    body = await parseBody(request)
  } catch (e) {
    if (e instanceof ParseError) return error(e.message, e.status)
    throw e
  }

  const validated = validateBody(body, reorderSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    // Update each view's order in a transaction
    await prisma.$transaction(
      parsedData.orders.map((item) =>
        prisma.customView.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    )

    return success()
  } catch (err) {
    console.error("Error reordering custom views:", err)
    return error("Failed to reorder custom views")
  }
}
