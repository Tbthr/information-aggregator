import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { success, error, parseBody, validateBody, handlePrismaError, ParseError } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Topic creation
const topicCreateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  includeRules: z.array(z.string()).default([]),
  excludeRules: z.array(z.string()).default([]),
  scoreBoost: z.number().min(0).max(10).default(1.0),
  displayOrder: z.number().int().default(0),
  maxItems: z.number().int().min(1).max(100).default(10),
})

export async function GET() {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { displayOrder: "asc" },
    })

    return success({ topics })
  } catch (err) {
    console.error("Error in /api/topics:", err)
    return error("Failed to load topics")
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await parseBody(request)
  } catch (e) {
    if (e instanceof ParseError) return error(e.message, e.status)
    throw e
  }

  const validated = validateBody(body, topicCreateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    const topic = await prisma.topic.create({
      data: {
        ...(parsedData.id && { id: parsedData.id }),
        name: parsedData.name,
        description: parsedData.description,
        includeRules: parsedData.includeRules,
        excludeRules: parsedData.excludeRules,
        scoreBoost: parsedData.scoreBoost,
        displayOrder: parsedData.displayOrder,
        maxItems: parsedData.maxItems,
      },
    })

    return success(topic)
  } catch (err) {
    console.error("Error creating topic:", err)

    const prismaErr = handlePrismaError(err, {
      p2002: "Topic with this ID or name already exists",
    })
    if (prismaErr) return prismaErr

    return error("Failed to create topic")
  }
}
