import type { Article, NewsFlash, TimelineEvent, CustomView, DailyOverview, WeeklyReport } from "./types"

// API Response Types
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    timing?: {
      generatedAt: string
      latencyMs: number
    }
    pagination?: {
      total: number
      page: number
      pageSize: number
      totalPages: number
    }
    query?: {
      packIds: string[]
      window: "today" | "week" | "month"
      sourceIds?: string[]
      sourceTypes?: string[]
      page: number
      pageSize: number
      sort: "ranked" | "recent"
      search?: string
    }
  }
}

// Item data from API
interface ItemData {
  id: string
  title: string
  url: string
  canonicalUrl: string
  source: {
    id: string
    type: string
    packId: string
  }
  publishedAt: string | null
  fetchedAt: string
  snippet: string | null
  author: string | null
  score: number
  scores: {
    sourceWeight: number
    freshness: number
    engagement: number
    contentQuality: number
  }
  metadata: Record<string, unknown>

  // New enrichment fields
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
  sourceName: string
  isBookmarked: boolean
}

// Query params for fetching items
export interface FetchItemsParams {
  packs?: string
  sources?: string
  sourceTypes?: string
  window?: "today" | "week" | "month"
  page?: number
  pageSize?: number
  sort?: "ranked" | "recent"
  search?: string
}

// Fetch result with pagination info
export interface FetchItemsResult {
  items: Article[]
  sources: Array<{
    id: string
    type: string
    packId: string
    itemCount: number
  }>
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

// Daily API response type
interface DailyData {
  overview: DailyOverview
  spotlightArticles: Article[]
  recommendedArticles: Article[]
  newsFlashes: NewsFlash[]
}

// Weekly API response type
interface WeeklyData {
  hero: WeeklyReport
  timelineEvents: TimelineEvent[]
  deepDives: Article[]
}

// News flashes API response type
interface NewsFlashesData {
  newsFlashes: Array<NewsFlash & { itemId?: string }>
}

// Custom views API response type
interface CustomViewsData {
  views: Array<{
    id: string
    name: string
    icon: string
    description: string
    itemCount: number
  }>
}

// Bookmarks API response type
interface BookmarksData {
  items: ItemData[]
  total: number
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP error: ${response.status}`,
      }
    }

    return data as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

/**
 * Map API ItemData to Article type
 */
export function mapItemToArticle(item: ItemData): Article {
  return {
    id: item.id,
    title: item.title,
    source: item.sourceName || item.source.type,
    sourceUrl: item.canonicalUrl || item.url,
    publishedAt: item.publishedAt || item.fetchedAt,
    summary: item.summary || item.snippet || "",
    bullets: item.bullets || [],
    content: item.content || "",
    imageUrl: item.imageUrl ?? undefined,
    category: item.categories?.[0] ?? undefined,
    aiScore: item.score,
    isBookmarked: item.isBookmarked,
  }
}

/**
 * Fetch items list with query parameters
 */
export async function fetchItems(params: FetchItemsParams = {}): Promise<FetchItemsResult> {
  const searchParams = new URLSearchParams()

  if (params.packs) searchParams.set("packs", params.packs)
  if (params.sources) searchParams.set("sources", params.sources)
  if (params.sourceTypes) searchParams.set("sourceTypes", params.sourceTypes)
  if (params.window) searchParams.set("window", params.window)
  if (params.page) searchParams.set("page", String(params.page))
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize))
  if (params.sort) searchParams.set("sort", params.sort)
  if (params.search) searchParams.set("search", params.search)

  const url = `/api/items${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
  const response = await fetchApi<{ items: ItemData[]; sources: FetchItemsResult["sources"] }>(url)

  if (!response.success || !response.data) {
    return {
      items: [],
      sources: [],
      pagination: {
        total: 0,
        page: params.page || 1,
        pageSize: params.pageSize || 20,
        totalPages: 0,
      },
    }
  }

  return {
    items: response.data.items.map(mapItemToArticle),
    sources: response.data.sources,
    pagination: response.meta?.pagination || {
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      totalPages: 0,
    },
  }
}

/**
 * Fetch bookmarks
 */
export async function fetchBookmarks(): Promise<Article[]> {
  const response = await fetchApi<BookmarksData>("/api/bookmarks")

  if (!response.success || !response.data) {
    return []
  }

  return response.data.items.map(mapItemToArticle)
}

/**
 * Add a bookmark
 */
export async function addBookmark(id: string): Promise<{ success: boolean; bookmarkedAt?: string }> {
  const response = await fetchApi<{ bookmarkedAt: string }>(`/api/bookmarks/${id}`, {
    method: "POST",
  })

  return {
    success: response.success,
    bookmarkedAt: response.data?.bookmarkedAt,
  }
}

/**
 * Remove a bookmark
 */
export async function removeBookmark(id: string): Promise<{ success: boolean }> {
  const response = await fetchApi<unknown>(`/api/bookmarks/${id}`, {
    method: "DELETE",
  })

  return {
    success: response.success,
  }
}

/**
 * Fetch daily overview data
 */
export async function fetchDailyOverview(): Promise<DailyData | null> {
  const response = await fetchApi<DailyData>("/api/daily")

  if (!response.success || !response.data) {
    return null
  }

  return response.data
}

/**
 * Fetch weekly report data
 */
export async function fetchWeeklyReport(): Promise<WeeklyData | null> {
  const response = await fetchApi<WeeklyData>("/api/weekly")

  if (!response.success || !response.data) {
    return null
  }

  return response.data
}

/**
 * Fetch news flashes
 */
export async function fetchNewsFlashes(): Promise<Array<NewsFlash & { itemId?: string }>> {
  const response = await fetchApi<NewsFlashesData>("/api/news-flashes")

  if (!response.success || !response.data) {
    return []
  }

  return response.data.newsFlashes
}

/**
 * Fetch custom views (list only, without articles)
 */
export async function fetchCustomViews(): Promise<CustomViewsData["views"]> {
  const response = await fetchApi<CustomViewsData>("/api/views")

  if (!response.success || !response.data) {
    return []
  }

  return response.data.views
}

/**
 * Fetch items for a specific custom view
 * This uses the items API with appropriate filters
 * Custom views are now associated with packs instead of individual items
 */
export async function fetchCustomViewItems(
  viewId: string,
  params: Omit<FetchItemsParams, "packs"> = {}
): Promise<FetchItemsResult> {
  // Custom views might filter by source types or other criteria
  // For now, we pass through to fetchItems with the view context
  return fetchItems({
    ...params,
    // In the future, this could filter by view-specific criteria
  })
}
