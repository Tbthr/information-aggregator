import type { Article, CustomView, DailyReportData, WeeklyReportData, Tweet, XPageConfigData, ApiResponse } from "./types"

// Item data from API
interface ItemData {
  id: string
  title: string
  url: string
  source: {
    id: string
    type: string
  }
  publishedAt: string | null
  fetchedAt: string
  firstSeenAt: string
  lastSeenAt: string
  author: string | null
  score: number
  metadata: Record<string, unknown>

  // New enrichment fields
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
  sourceName: string
  isBookmarked: boolean
  saved?: {
    savedAt: string
  }
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

// Custom views API response type
interface CustomViewsData {
  views: Array<{
    id: string
    name: string
    icon: string
    description: string
    customViewPacks: Array<{ packId: string; pack?: { id: string; name: string } }>
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
    sourceUrl: item.url,
    publishedAt: item.publishedAt || item.fetchedAt,
    summary: item.summary || "",
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
  const response = await fetchApi<{ bookmarkedAt: string }>(`/api/bookmarks/${encodeURIComponent(id)}`, {
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
  const response = await fetchApi<unknown>(`/api/bookmarks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

  return {
    success: response.success,
  }
}

/**
 * Fetch daily overview data
 */
export async function fetchDailyOverview(): Promise<DailyReportData | null> {
  const response = await fetchApi<DailyReportData>("/api/daily")

  if (!response.success || !response.data) {
    return null
  }

  return response.data
}

/**
 * Fetch weekly report data
 */
export async function fetchWeeklyReport(): Promise<WeeklyReportData | null> {
  const response = await fetchApi<WeeklyReportData>("/api/weekly")

  if (!response.success || !response.data) {
    return null
  }

  return response.data
}

/**
 * Fetch custom views (list only, without articles)
 */
export async function fetchCustomViews(): Promise<CustomViewsData["views"]> {
  const response = await fetchApi<CustomViewsData>("/api/custom-views")

  if (!response.success || !response.data) {
    return []
  }

  return response.data.views
}

/**
 * Fetch items for a specific custom view
 * Uses the view's associated packs to filter items
 */
export async function fetchCustomViewItems(
  viewId: string,
  params: Omit<FetchItemsParams, "packs"> = {}
): Promise<FetchItemsResult> {
  // 1. 获取视图关联的 pack IDs
  const viewsResponse = await fetchApi<CustomViewsData>("/api/custom-views")

  const emptyResult: FetchItemsResult = {
    items: [],
    sources: [],
    pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
  }

  if (!viewsResponse.success || !viewsResponse.data) {
    return emptyResult
  }

  const view = viewsResponse.data.views.find((v) => v.id === viewId)
  if (!view) {
    return emptyResult
  }

  const packIds = view.customViewPacks.map((p) => p.packId)

  // 2. 如果没有关联的 packs，返回空结果
  if (packIds.length === 0) {
    return emptyResult
  }

  // 3. 使用 pack IDs 获取文章
  return fetchItems({
    ...params,
    packs: packIds.join(","),
  })
}

// ── Tweet API ──

export interface FetchTweetsParams {
  tab?: string
  window?: "today" | "week" | "month"
  sort?: "ranked" | "recent" | "engagement"
  page?: number
  pageSize?: number
  search?: string
}

export async function fetchTweets(params: FetchTweetsParams = {}): Promise<{
  items: Tweet[]
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
}> {
  const sp = new URLSearchParams();
  if (params.tab) sp.set("tab", params.tab);
  if (params.window) sp.set("window", params.window);
  if (params.sort) sp.set("sort", params.sort);
  if (params.page) sp.set("page", String(params.page));
  if (params.pageSize) sp.set("pageSize", String(params.pageSize));
  if (params.search) sp.set("search", params.search);

  const res = await fetchApi<{ items: Tweet[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } }>(
    `/api/tweets?${sp.toString()}`,
  );

  if (!res.success || !res.data) {
    return {
      items: [],
      pagination: { total: 0, page: params.page || 1, pageSize: params.pageSize || 20, totalPages: 0 },
    }
  }

  return { items: res.data.items, pagination: res.data.pagination };
}

export async function fetchTweetBookmarks(): Promise<Tweet[]> {
  const res = await fetchApi<{ items: Tweet[] }>("/api/tweet-bookmarks");

  if (!res.success || !res.data) {
    return []
  }

  return res.data.items;
}

export async function addTweetBookmark(id: string): Promise<{ success: boolean; bookmarkedAt?: string }> {
  const res = await fetchApi<{ bookmarkedAt: string }>(`/api/tweet-bookmarks/${id}`, {
    method: "POST",
  });

  return {
    success: res.success,
    bookmarkedAt: res.data?.bookmarkedAt,
  }
}

export async function removeTweetBookmark(id: string): Promise<{ success: boolean }> {
  const res = await fetchApi<unknown>(`/api/tweet-bookmarks/${id}`, { method: "DELETE" });
  return { success: res.success };
}

export async function fetchXConfig(tab?: string): Promise<XPageConfigData[]> {
  const sp = tab ? `?tab=${tab}` : "";
  const res = await fetchApi<XPageConfigData[] | XPageConfigData>(`/api/x-config${sp}`);

  if (!res.success || !res.data) {
    return []
  }

  return Array.isArray(res.data) ? res.data : [res.data];
}

export async function updateXConfig(config: Partial<XPageConfigData> & { tab: string }): Promise<XPageConfigData | null> {
  const res = await fetchApi<XPageConfigData>("/api/x-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.success || !res.data) {
    return null
  }

  return res.data;
}
