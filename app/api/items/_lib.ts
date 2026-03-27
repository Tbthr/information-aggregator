import { Prisma } from "@prisma/client"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { utcStartOfDay } from "@/lib/date-utils"
import type {
  ApiResponse,
  BookmarksData,
  ItemData,
  ItemsData,
  ItemsQuery,
  ParsedItemsQuery,
  SourceInfo,
} from "./types"

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

const itemInclude = {
  source: {
    include: {
      pack: true,
    },
  },
  bookmarks: {
    select: {
      bookmarkedAt: true,
    },
  },
} as const

const bookmarkInclude = {
  item: {
    include: itemInclude,
  },
} as const

type ItemRecord = Prisma.ItemGetPayload<{ include: typeof itemInclude }>
type BookmarkRecord = Prisma.BookmarkGetPayload<{ include: typeof bookmarkInclude }>

export function parseItemsQuery(searchParams: URLSearchParams): ParsedItemsQuery {
  const parsed = itemsQuerySchema.safeParse({
    packs: searchParams.get("packs") ?? undefined,
    sources: searchParams.get("sources") ?? undefined,
    sourceTypes: searchParams.get("sourceTypes") ?? undefined,
    window: searchParams.get("window") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    search: normalizeOptional(searchParams.get("search")),
  })

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid query parameters",
    }
  }

  return {
    success: true,
    data: parsed.data,
  }
}

export async function listItems(query: ItemsQuery): Promise<ApiResponse<ItemsData>> {
  const where = buildItemsWhere(query)
  const [total, rows] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      include: itemInclude,
      orderBy:
        query.sort === "recent"
          ? [{ fetchedAt: "desc" }]
          : [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
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

export async function getBookmarks(): Promise<BookmarksData> {
  const rows = await prisma.bookmark.findMany({
    include: bookmarkInclude,
    orderBy: {
      bookmarkedAt: "desc",
    },
  })

  return {
    items: rows.map((row) => serializeBookmark(row)),
    total: rows.length,
  }
}

export async function addBookmark(id: string): Promise<{ bookmarkedAt: string; already?: true } | null> {
  const existingItem = await prisma.item.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!existingItem) {
    return null
  }

  const existingBookmark = await prisma.bookmark.findUnique({
    where: { itemId: id },
    select: { bookmarkedAt: true },
  })

  if (existingBookmark) {
    return { bookmarkedAt: existingBookmark.bookmarkedAt.toISOString(), already: true }
  }

  const created = await prisma.bookmark.create({
    data: { itemId: id },
    select: { bookmarkedAt: true },
  })

  return { bookmarkedAt: created.bookmarkedAt.toISOString() }
}

export async function removeBookmark(id: string): Promise<boolean> {
  const result = await prisma.bookmark.deleteMany({
    where: { itemId: id },
  })

  return result.count > 0
}

function buildItemsWhere(query: ItemsQuery): Prisma.ItemWhereInput {
  const and: Prisma.ItemWhereInput[] = []
  const packIds = splitCsv(query.packs)
  const sourceIds = splitCsv(query.sources)
  const sourceTypes = splitCsv(query.sourceTypes)
  const since = resolveWindowStart(query.window)

  if (packIds.length > 0) {
    and.push({
      source: { packId: { in: packIds } },
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
        { summary: { contains: query.search, mode: "insensitive" } },
        { content: { contains: query.search, mode: "insensitive" } },
        { sourceName: { contains: query.search, mode: "insensitive" } },
      ],
    })
  }

  return and.length > 0 ? { AND: and } : {}
}

function serializeItem(item: ItemRecord): ItemData {
  const bookmarkedAt = item.bookmarks[0]?.bookmarkedAt?.toISOString()
  const metadata = parseJson<Record<string, unknown>>(item.metadataJson, {})

  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: {
      id: item.sourceId,
      type: item.sourceType || item.source.type || "unknown",
    },
    sourceName: item.sourceName || item.source.name || item.sourceType,
    publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
    fetchedAt: item.fetchedAt.toISOString(),
    firstSeenAt: item.fetchedAt.toISOString(),
    lastSeenAt: item.fetchedAt.toISOString(),
    author: item.author ?? null,
    isBookmarked: !!bookmarkedAt,
    saved: bookmarkedAt ? { savedAt: bookmarkedAt } : undefined,
    metadata,
    summary: item.summary ?? null,
    content: item.content ?? null,
  }
}

function serializeBookmark(bookmark: BookmarkRecord): ItemData {
  const item = serializeItem(bookmark.item)
  return {
    ...item,
    isBookmarked: true,
    saved: {
      savedAt: bookmark.bookmarkedAt.toISOString(),
    },
  }
}

function summarizeSources(rows: ItemRecord[]): SourceInfo[] {
  const stats = new Map<
    string,
    {
      type: string
      count: number
      lastSuccessAt: string | null
    }
  >()

  for (const row of rows) {
    const current = stats.get(row.sourceId) ?? {
      type: row.sourceType || row.source.type || "unknown",
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
    itemCount: value.count,
    health: {
      lastSuccessAt: value.lastSuccessAt,
      lastFailureAt: null,
      consecutiveFailures: 0,
    },
  }))
}

function resolveWindowStart(window: ItemsQuery["window"]): Date | null {
  const now = new Date()

  switch (window) {
    case "today": {
      return utcStartOfDay(now)
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

function normalizeOptional(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
