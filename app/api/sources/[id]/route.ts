import { z } from "zod"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, handlePrismaError, ParseError } from "@/lib/api-response"

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
  kind: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  defaultTopicIds: z.array(z.string()).optional(),
  configJson: z.string().nullable().optional(),
  priority: z.number().int().optional(),
  authRef: z.string().nullable().optional(),
})

export async function PATCH(
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

  const validated = validateBody(body, sourceUpdateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    // Find the source by id
    const existingSource = await findSourceById(id)
    if (!existingSource) {
      return error("Source not found", 404)
    }

    // Build update data, only including defined fields
    const updateData: Prisma.SourceUpdateInput = {}

    if (parsedData.kind !== undefined) updateData.kind = parsedData.kind
    if (parsedData.name !== undefined) updateData.name = parsedData.name
    if (parsedData.url !== undefined) updateData.url = parsedData.url
    if (parsedData.description !== undefined) {
      updateData.description = parsedData.description === null ? { set: null } : parsedData.description
    }
    if (parsedData.enabled !== undefined) updateData.enabled = parsedData.enabled
    if (parsedData.defaultTopicIds !== undefined) updateData.defaultTopicIds = parsedData.defaultTopicIds
    if (parsedData.configJson !== undefined) updateData.configJson = parsedData.configJson
    if (parsedData.priority !== undefined) updateData.priority = parsedData.priority
    if (parsedData.authRef !== undefined) {
      updateData.authRef = parsedData.authRef === null ? { set: null } : parsedData.authRef
    }

    const source = await prisma.source.update({
      where: { id: existingSource.id }, // Always use the actual id for update
      data: updateData,
    })

    return success(source)
  } catch (err) {
    console.error("Error updating source:", err)

    const prismaErr = handlePrismaError(err, {})
    if (prismaErr) return prismaErr

    return error("Failed to update source")
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
      return error("Source not found", 404)
    }

    await prisma.source.delete({
      where: { id: existingSource.id }, // Always use the actual id for delete
    })

    return success()
  } catch (err) {
    console.error("Error deleting source:", err)

    return error("Failed to delete source")
  }
}
