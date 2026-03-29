import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, handlePrismaError, ParseError } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Topic update
const topicUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  includeRules: z.array(z.string()).optional(),
  excludeRules: z.array(z.string()).optional(),
  scoreBoost: z.number().min(0).max(10).optional(),
  displayOrder: z.number().int().optional(),
  maxItems: z.number().int().min(1).max(100).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const topic = await prisma.topic.findUnique({
      where: { id },
    })

    if (!topic) {
      return error("Topic not found", 404)
    }

    return success(topic)
  } catch (err) {
    console.error("Error fetching topic:", err)
    return error("Failed to load topic")
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

  const validated = validateBody(body, topicUpdateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    const topic = await prisma.topic.update({
      where: { id },
      data: {
        ...(parsedData.name !== undefined && { name: parsedData.name }),
        ...(parsedData.description !== undefined && { description: parsedData.description }),
        ...(parsedData.includeRules !== undefined && { includeRules: parsedData.includeRules }),
        ...(parsedData.excludeRules !== undefined && { excludeRules: parsedData.excludeRules }),
        ...(parsedData.scoreBoost !== undefined && { scoreBoost: parsedData.scoreBoost }),
        ...(parsedData.displayOrder !== undefined && { displayOrder: parsedData.displayOrder }),
        ...(parsedData.maxItems !== undefined && { maxItems: parsedData.maxItems }),
      },
    })

    return success(topic)
  } catch (err) {
    console.error("Error updating topic:", err)

    const prismaErr = handlePrismaError(err, {
      p2025: "Topic not found",
      p2002: "Topic name already exists",
    })
    if (prismaErr) return prismaErr

    return error("Failed to update topic")
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.topic.delete({
      where: { id },
    })

    return success()
  } catch (err) {
    console.error("Error deleting topic:", err)

    const prismaErr = handlePrismaError(err, {
      p2025: "Topic not found",
    })
    if (prismaErr) return prismaErr

    return error("Failed to delete topic")
  }
}
