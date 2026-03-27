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

export type { ApiResponse } from "@/lib/types"

export interface SourceInfo {
  id: string
  type: string
  itemCount: number
  health: {
    lastSuccessAt: string | null
    lastFailureAt: string | null
    consecutiveFailures: number
  }
}

export interface ItemData {
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
  saved?: {
    savedAt: string
  }
  metadata: Record<string, unknown>

  summary: string | null
  content: string | null
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
