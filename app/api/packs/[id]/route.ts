import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, handlePrismaError, ParseError } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Pack update
const packUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
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
      return error("Pack not found", 404)
    }

    return success(pack)
  } catch (err) {
    console.error("Error fetching pack:", err)
    return error("Failed to load pack")
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: unknown
  try {
    body = await parseBody(request)
  } catch (e) {
    if (e instanceof ParseError) return error(e.message, e.status)
    throw e
  }

  const validated = validateBody(body, packUpdateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    const pack = await prisma.pack.update({
      where: { id },
      data: parsedData,
    })

    return success(pack)
  } catch (err) {
    console.error("Error updating pack:", err)

    const prismaErr = handlePrismaError(err, {
      p2025: "Pack not found",
    })
    if (prismaErr) return prismaErr

    return error("Failed to update pack")
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

    return success()
  } catch (err) {
    console.error("Error deleting pack:", err)

    const prismaErr = handlePrismaError(err, {
      p2025: "Pack not found",
    })
    if (prismaErr) return prismaErr

    return error("Failed to delete pack")
  }
}
