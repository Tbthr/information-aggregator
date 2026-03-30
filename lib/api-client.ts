import type { Tweet, XPageConfigData, ApiResponse } from "./types"

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

// ── Internal ──

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
