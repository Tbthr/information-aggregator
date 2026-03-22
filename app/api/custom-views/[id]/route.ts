import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, handlePrismaError, ParseError } from "@/lib/api-response"

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
        customViewPacks: {
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
      return error("Custom view not found", 404)
    }

    return success(view)
  } catch (err) {
    console.error("Error fetching custom view:", err)
    return error("Failed to load custom view")
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

  const validated = validateBody(body, customViewUpdateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    // Build update data conditionally
    const updateData: Prisma.CustomViewUpdateInput = {}

    if (parsedData.name !== undefined) {
      updateData.name = parsedData.name
    }
    if (parsedData.icon !== undefined) {
      updateData.icon = parsedData.icon
    }
    if (parsedData.description !== undefined) {
      updateData.description = parsedData.description
    }
    if (parsedData.filterJson !== undefined) {
      updateData.filterJson = parsedData.filterJson
    }
    if (parsedData.packIds !== undefined) {
      updateData.customViewPacks = {
        deleteMany: {},
        create: parsedData.packIds.map((packId) => ({ packId })),
      }
    }

    const view = await prisma.customView.update({
      where: { id },
      data: updateData,
      include: {
        customViewPacks: {
          include: {
            pack: true,
          },
        },
      },
    })

    return success(view)
  } catch (err) {
    console.error("Error updating custom view:", err)

    const prismaErr = handlePrismaError(err, {
      p2025: "Custom view not found",
      p2003: "One or more pack IDs do not exist",
    })
    if (prismaErr) return prismaErr

    return error("Failed to update custom view")
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

    return success()
  } catch (err) {
    console.error("Error deleting custom view:", err)

    const prismaErr = handlePrismaError(err, {
      p2025: "Custom view not found",
    })
    if (prismaErr) return prismaErr

    return error("Failed to delete custom view")
  }
}
