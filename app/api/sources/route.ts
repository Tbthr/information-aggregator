import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { loadAllTopicsFromDb } from "../../../src/config/load-pack-prisma"
import { success, error, parseBody, validateBody, startTimer, timing, handlePrismaError, ParseError } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Zod schema for Source creation (kind replaces type, defaultTopicIds replaces packId)
const sourceCreateSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.string().min(1),
  name: z.string().min(1),
  url: z.string().min(1),
  description: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  defaultTopicIds: z.array(z.string()).default([]),
  configJson: z.string().nullable().optional(),
  priority: z.number().int().default(0),
  authRef: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const startTime = startTimer()
    const [topics, persistedSources] = await Promise.all([
      loadAllTopicsFromDb(),
      prisma.source.findMany({
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),
    ])

    // Build lookup map by id
    const persistedById = new Map(persistedSources.map((s) => [s.id, s]))

    // Build sources from config and persisted data
    const allSources = persistedSources.map((source) => ({
      id: source.id,
      kind: source.kind,
      name: source.name,
      url: source.url,
      description: source.description,
      enabled: source.enabled,
      defaultTopicIds: source.defaultTopicIds,
      configJson: source.configJson,
      priority: source.priority,
      authRef: source.authRef,
    }))

    return success(
      { sources: allSources, topics },
      { timing: timing(startTime) }
    )
  } catch (err) {
    console.error("Error in /api/sources:", err)
    return error("Failed to load sources")
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

  const validated = validateBody(body, sourceCreateSchema)
  if (!validated.success) return validated.response
  const { data: parsedData } = validated

  try {
    const source = await prisma.source.create({
      data: {
        ...(parsedData.id && { id: parsedData.id }),
        kind: parsedData.kind,
        name: parsedData.name,
        url: parsedData.url,
        description: parsedData.description,
        enabled: parsedData.enabled ?? true,
        defaultTopicIds: parsedData.defaultTopicIds,
        configJson: parsedData.configJson,
        priority: parsedData.priority,
        authRef: parsedData.authRef,
      },
    })

    return success(source)
  } catch (err) {
    console.error("Error creating source:", err)

    const prismaErr = handlePrismaError(err, {
      p2002: "Source with this ID already exists",
    })
    if (prismaErr) return prismaErr

    return error("Failed to create source")
  }
}
