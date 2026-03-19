import { Prisma } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import type { ApiResponse, ItemData, ItemsData, SourceInfo } from "../../../../src/api/types"

const itemsQuerySchema = z.object({
  packs: z.string().optional(),
  sources: z.string().optional(),
  sourceTypes: z.string().optional(),
  window: z.enum(["today", "week", "month"]).default("week"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["ranked", "recent"]).default("ranked"),
  search: z.string().trim().min(1).optional(),
})

export type ParsedItemsQuery = z.infer<typeof itemsQuerySchema>

const itemInclude = {
  source: {
    include: {
      pack: true,
    },
  },
  savedItems: {
    select: {
      savedAt: true,
    },
  },
} as const

const savedItemInclude = {
  item: {
    include: itemInclude,
  },
} as const

type ItemRecord = Prisma.ItemGetPayload<{ include: typeof itemInclude }>
type SavedItemRecord = Prisma.SavedItemGetPayload<{ include: typeof savedItemInclude }>

export function parseItemsQuery(searchParams: URLSearchParams): ParsedItemsQuery {
  return itemsQuerySchema.parse({
    packs: searchParams.get("packs") ?? undefined,
    sources: searchParams.get("sources") ?? undefined,
    sourceTypes: searchParams.get("sourceTypes") ?? undefined,
    window: searchParams.get("window") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    search: normalizeOptional(searchParams.get("search")),
  })
}

export async function listItems(query: ParsedItemsQuery): Promise<ApiResponse<ItemsData>> {
  const where = buildItemsWhere(query)
  const [total, rows] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      include: itemInclude,
      orderBy:
        query.sort === "recent"
          ? [{ fetchedAt: "desc" }]
          : [{ score: "desc" }, { fetchedAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])

  const items = rows.map((row) => serializeItem(row))
  const sources = summarizeSources(rows)

  return {
    success: true,
    data: { items, sources },
    meta: {
      query: {
        packIds: splitCsv(query.packs),
        window: query.window,
        sourceIds: optionalCsv(query.sources),
        sourceTypes: optionalCsv(query.sourceTypes),
        page: query.page,
        pageSize: query.pageSize,
        sort: query.sort,
        search: query.search,
      },
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: 0,
      },
      pagination: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      },
    },
  }
}

export async function getItemById(id: string): Promise<ItemData | null> {
  const item = await prisma.item.findUnique({
    where: { id },
    include: itemInclude,
  })

  return item ? serializeItem(item) : null
}

export async function getSavedItems(): Promise<{
  items: ItemData[]
  total: number
}> {
  const rows = await prisma.savedItem.findMany({
    include: savedItemInclude,
    orderBy: {
      savedAt: "desc",
    },
  })

  return {
    items: rows.map((row) => serializeSavedItem(row)),
    total: rows.length,
  }
}

export async function saveItemById(id: string): Promise<{ savedAt: string; already?: true } | null> {
  const existingItem = await prisma.item.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existingItem) {
    return null
  }

  const existingSaved = await prisma.savedItem.findUnique({
    where: { itemId: id },
    select: { savedAt: true },
  })

  if (existingSaved) {
    return { savedAt: existingSaved.savedAt.toISOString(), already: true }
  }

  const created = await prisma.savedItem.upsert({
    where: { itemId: id },
    create: { itemId: id },
    update: {},
    select: { savedAt: true },
  })

  return { savedAt: created.savedAt.toISOString() }
}

export async function deleteSavedItemById(id: string): Promise<boolean> {
  const result = await prisma.savedItem.deleteMany({
    where: { itemId: id },
  })

  return result.count > 0
}

function buildItemsWhere(query: ParsedItemsQuery): Prisma.ItemWhereInput {
  const and: Prisma.ItemWhereInput[] = []
  const packIds = splitCsv(query.packs)
  const sourceIds = splitCsv(query.sources)
  const sourceTypes = splitCsv(query.sourceTypes)
  const since = resolveWindowStart(query.window)

  if (packIds.length > 0) {
    and.push({
      OR: [
        { packId: { in: packIds } },
        { source: { packId: { in: packIds } } },
      ],
    })
  }

  if (sourceIds.length > 0) {
    and.push({ sourceId: { in: sourceIds } })
  }

  if (sourceTypes.length > 0) {
    and.push({ sourceType: { in: sourceTypes } })
  }

  if (since) {
    and.push({ fetchedAt: { gte: since } })
  }

  if (query.search) {
    and.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { snippet: { contains: query.search, mode: "insensitive" } },
        { summary: { contains: query.search, mode: "insensitive" } },
        { content: { contains: query.search, mode: "insensitive" } },
        { sourceName: { contains: query.search, mode: "insensitive" } },
      ],
    })
  }

  return and.length > 0 ? { AND: and } : {}
}

function serializeItem(item: ItemRecord): ItemData {
  const savedAt = item.savedItems[0]?.savedAt?.toISOString()
  const metadata = parseJson<Record<string, unknown>>(item.metadataJson, {})
  const scores = parseJson<Partial<ItemData["scores"]>>(item.scoresJson, {
    sourceWeight: 1,
    freshness: 0.5,
    engagement: 0.5,
    contentQuality: 0.5,
  })

  return {
    id: item.id,
    title: item.title,
    url: item.url,
    canonicalUrl: item.canonicalUrl,
    source: {
      id: item.sourceId,
      type: item.sourceType || item.source.type || "unknown",
      packId: item.packId ?? item.source.packId ?? "unknown",
    },
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
    fetchedAt: item.fetchedAt.toISOString(),
    firstSeenAt: item.fetchedAt.toISOString(),
    lastSeenAt: item.fetchedAt.toISOString(),
    snippet: item.snippet ?? null,
    author: item.author ?? null,
    score: item.score,
    scores: {
      sourceWeight: toNumber(scores.sourceWeight, 0),
      freshness: toNumber(scores.freshness, 0),
      engagement: toNumber(scores.engagement, 0),
      contentQuality: toNumber(scores.contentQuality, 0),
    },
    saved: savedAt ? { savedAt } : undefined,
    metadata,
  }
}

function serializeSavedItem(savedItem: SavedItemRecord): ItemData {
  const item = serializeItem(savedItem.item)
  return {
    ...item,
    saved: {
      savedAt: savedItem.savedAt.toISOString(),
    },
  }
}

function summarizeSources(rows: ItemRecord[]): SourceInfo[] {
  const stats = new Map<
    string,
    {
      type: string
      packId: string
      count: number
      lastSuccessAt: string | null
    }
  >()

  for (const row of rows) {
    const current = stats.get(row.sourceId) ?? {
      type: row.sourceType || row.source.type || "unknown",
      packId: row.packId ?? row.source.packId ?? "unknown",
      count: 0,
      lastSuccessAt: null as string | null,
    }
    current.count += 1
    current.lastSuccessAt = row.fetchedAt.toISOString()
    stats.set(row.sourceId, current)
  }

  return Array.from(stats.entries()).map(([id, value]) => ({
    id,
    type: value.type,
    packId: value.packId,
    itemCount: value.count,
    health: {
      lastSuccessAt: value.lastSuccessAt,
      lastFailureAt: null,
      consecutiveFailures: 0,
    },
  }))
}

function resolveWindowStart(window: ParsedItemsQuery["window"]): Date | null {
  const now = new Date()

  switch (window) {
    case "today": {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return start
    }
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return null
}

function splitCsv(value?: string): string[] {
  return value?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? []
}

function optionalCsv(value?: string): string[] | undefined {
  const entries = splitCsv(value)
  return entries.length > 0 ? entries : undefined
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function toNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function normalizeOptional(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
