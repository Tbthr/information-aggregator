export interface ApiQueryMeta {
  packIds: string[]
  window: "today" | "week" | "month"
  sourceIds?: string[]
  sourceTypes?: string[]
  page: number
  pageSize: number
  sort: "ranked" | "recent"
  search?: string
}

export interface ApiTimingMeta {
  generatedAt: string
  latencyMs: number
}

export interface ApiPaginationMeta {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: true
  data: T
  meta: {
    query: ApiQueryMeta
    timing: ApiTimingMeta
    pagination: ApiPaginationMeta
  }
  warnings?: string[]
}

export interface SourceInfo {
  id: string
  type: string
  packId: string
  itemCount: number
  health: {
    lastSuccessAt: string | null
    lastFailureAt: string | null
    consecutiveFailures: number
  }
}

export interface ItemScores {
  sourceWeight: number
  freshness: number
  engagement: number
  contentQuality: number
}

export interface ItemData {
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
  firstSeenAt: string
  lastSeenAt: string
  snippet: string | null
  author: string | null
  score: number
  scores: ItemScores
  saved?: {
    savedAt: string
  }
  metadata: Record<string, unknown>

  // 新增字段
  summary: string | null
  bullets: string[]
  content: string | null
  imageUrl: string | null
  categories: string[]
  sourceName: string
  isBookmarked: boolean
}

export interface ItemsData {
  items: ItemData[]
  sources: SourceInfo[]
}

export interface BookmarksData {
  items: ItemData[]
  total: number
}

export interface ItemsQuery {
  packs?: string
  sources?: string
  sourceTypes?: string
  window: ApiQueryMeta["window"]
  page: number
  pageSize: number
  sort: ApiQueryMeta["sort"]
  search?: string
}

export type ParsedItemsQuery =
  | { success: true; data: ItemsQuery }
  | { success: false; error: string }
