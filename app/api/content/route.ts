import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { success, error } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const contentQuerySchema = z.object({
  topicIds: z.string().optional(),
  sourceIds: z.string().optional(),
  kinds: z.string().optional(),
  window: z.enum(["today", "week", "month"]).default("week"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["ranked", "recent"]).default("ranked"),
  search: z.string().trim().min(1).optional(),
})

function splitCsv(value?: string): string[] {
  return value?.split(",").map((e) => e.trim()).filter(Boolean) ?? []
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const parsed = contentQuerySchema.safeParse({
    topicIds: searchParams.get("topicIds") ?? undefined,
    sourceIds: searchParams.get("sourceIds") ?? undefined,
    kinds: searchParams.get("kinds") ?? undefined,
    window: searchParams.get("window") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  })

  if (!parsed.success) {
    return error("Invalid query parameters", 400)
  }

  const query = parsed.data
  const queryWithoutSp = { page: query.page, pageSize: query.pageSize, sort: query.sort }

  const where: Record<string, unknown> = {}
  const topicIds = splitCsv(query.topicIds)
  const sourceIds = splitCsv(query.sourceIds)
  const kinds = splitCsv(query.kinds)

  // Time window filter
  const now = new Date()
  let since: Date
  switch (query.window) {
    case "today":
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case "week":
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "month":
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }
  where.fetchedAt = { gte: since }

  if (topicIds.length > 0) {
    // Content has topicIds array field
    where.topicIds = { hasSome: topicIds }
  }

  if (sourceIds.length > 0) {
    where.sourceId = { in: sourceIds }
  }

  if (kinds.length > 0) {
    where.kind = { in: kinds }
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { body: { contains: query.search, mode: "insensitive" } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.content.count({ where }),
    prisma.content.findMany({
      where,
      orderBy:
        query.sort === "recent"
          ? [{ fetchedAt: "desc" }]
          : [{ qualityScore: "desc" }, { fetchedAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])

  const contents = rows.map((c) => ({
    id: c.id,
    kind: c.kind,
    sourceId: c.sourceId,
    title: c.title,
    body: c.body,
    url: c.url,
    authorLabel: c.authorLabel,
    publishedAt: c.publishedAt?.toISOString() ?? null,
    fetchedAt: c.fetchedAt.toISOString(),
    engagementScore: c.engagementScore,
    qualityScore: c.qualityScore,
    topicIds: c.topicIds,
    topicScoresJson: c.topicScoresJson,
    metadataJson: c.metadataJson,
  }))

  return success(
    { contents },
    {
      meta: {
        pagination: {
          total,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: Math.ceil(total / query.pageSize),
        },
        query: queryWithoutSp,
      },
    }
  )
}
