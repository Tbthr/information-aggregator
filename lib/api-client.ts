import type { Article, CustomView, Tweet, XPageConfigData, ApiResponse } from "./types"

// Custom views API response type
interface CustomViewsData {
  views: Array<{
    id: string
    name: string
    icon: string
    description: string
    topicIds?: string[]
  }>
}

// Bookmarks API response type (legacy, items-based)
interface BookmarksData {
  items: Array<{
    id: string
    title: string
    url: string
    sourceName: string
    sourceType: string
    publishedAt: string | null
    fetchedAt: string
    summary: string | null
    content: string | null
    isBookmarked: boolean
  }>
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
 * Fetch bookmarks
 */
export async function fetchBookmarks(): Promise<Article[]> {
  const response = await fetchApi<BookmarksData>("/api/bookmarks")

  if (!response.success || !response.data) {
    return []
  }

  return response.data.items.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.sourceName || item.sourceType,
    sourceUrl: item.url,
    publishedAt: item.publishedAt || item.fetchedAt,
    summary: item.summary || "",
    content: item.content || "",
    isBookmarked: item.isBookmarked,
  }))
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
 * Fetch content for a specific custom view
 * Uses the view's associated topicIds to filter content via Content API
 */
export async function fetchCustomViewItems(
  viewId: string,
  params: { window?: "today" | "week" | "month"; sort?: "ranked" | "recent"; search?: string } = {}
): Promise<{ items: Article[] }> {
  // 1. Get the view's associated topic IDs
  const viewsResponse = await fetchApi<CustomViewsData>("/api/custom-views")

  if (!viewsResponse.success || !viewsResponse.data) {
    return { items: [] }
  }

  const view = viewsResponse.data.views.find((v) => v.id === viewId)
  if (!view) {
    return { items: [] }
  }

  const topicIds = view.topicIds || []

  // 2. If no associated topics, return empty
  if (topicIds.length === 0) {
    return { items: [] }
  }

  // 3. Fetch content via Content API using topicIds
  const result = await fetchContent({
    ...params,
    topicIds: topicIds.join(","),
  })

  // 4. Map Content to Article format
  const items = result.contents.map((c) => ({
    id: c.id,
    title: c.title || "",
    source: c.authorLabel || c.sourceId,
    sourceUrl: c.url,
    publishedAt: c.publishedAt || c.fetchedAt,
    summary: "",
    content: c.body || "",
    isBookmarked: false,
  }))

  return { items }
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

// ── Topics API ──

export interface TopicData {
  id: string
  name: string
  description?: string | null
  includeRules: string[]
  excludeRules: string[]
  scoreBoost: number
  displayOrder: number
  maxItems: number
}

export interface FetchTopicsResult {
  topics: TopicData[]
}

export async function fetchTopics(): Promise<TopicData[]> {
  const res = await fetchApi<FetchTopicsResult>("/api/topics")

  if (!res.success || !res.data) {
    return []
  }

  return res.data.topics
}

export async function createTopic(data: Omit<TopicData, "id"> & { id?: string }): Promise<TopicData | null> {
  const res = await fetchApi<TopicData>("/api/topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!res.success || !res.data) {
    return null
  }

  return res.data
}

export async function updateTopic(id: string, data: Partial<TopicData>): Promise<TopicData | null> {
  const res = await fetchApi<TopicData>(`/api/topics/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!res.success || !res.data) {
    return null
  }

  return res.data
}

export async function deleteTopic(id: string): Promise<boolean> {
  const res = await fetchApi<unknown>(`/api/topics/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })

  return res.success
}

// ── Content API ──

export interface ContentParams {
  topicIds?: string
  sourceIds?: string
  kinds?: string
  window?: "today" | "week" | "month"
  page?: number
  pageSize?: number
  sort?: "ranked" | "recent"
  search?: string
}

export interface ContentData {
  id: string
  kind: string
  sourceId: string
  title?: string | null
  body?: string | null
  url: string
  authorLabel?: string | null
  publishedAt?: string | null
  fetchedAt: string
  engagementScore?: number | null
  qualityScore?: number | null
  topicIds: string[]
  topicScoresJson?: string | null
  metadataJson?: string | null
}

export interface FetchContentResult {
  contents: ContentData[]
}

export async function fetchContent(params: ContentParams = {}): Promise<FetchContentResult> {
  const sp = new URLSearchParams()

  if (params.topicIds) sp.set("topicIds", params.topicIds)
  if (params.sourceIds) sp.set("sourceIds", params.sourceIds)
  if (params.kinds) sp.set("kinds", params.kinds)
  if (params.window) sp.set("window", params.window)
  if (params.page) sp.set("page", String(params.page))
  if (params.pageSize) sp.set("pageSize", String(params.pageSize))
  if (params.sort) sp.set("sort", params.sort)
  if (params.search) sp.set("search", params.search)

  const url = `/api/content${sp.toString() ? `?${sp.toString()}` : ""}`
  const res = await fetchApi<FetchContentResult>(url)

  if (!res.success || !res.data) {
    return { contents: [] }
  }

  return res.data
}

export async function fetchContentById(id: string): Promise<ContentData | null> {
  const res = await fetchApi<ContentData>(`/api/content/${encodeURIComponent(id)}`)

  if (!res.success || !res.data) {
    return null
  }

  return res.data
}
