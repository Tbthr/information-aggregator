/**
 * API 响应类型定义（与后端 src/api/types.ts 保持同步）
 */

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueryMeta {
  packIds: string[];
  window: string;
  sourceIds?: string[];
  page: number;
  pageSize: number;
  sort: string;
  search?: string;
}

export interface TimingMeta {
  generatedAt: string;
  latencyMs: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    query: QueryMeta;
    timing: TimingMeta;
    pagination: PaginationMeta;
  };
  warnings?: string[];
}

export interface SourceInfo {
  id: string;
  type: string;
  packId: string;
  itemCount: number;
  health: {
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
  };
}

export interface ScoreInfo {
  sourceWeight: number;
  freshness: number;
  engagement: number;
  topicMatch: number;
  contentQuality: number;
}

export interface ItemData {
  id: string;
  title: string;
  url: string;
  canonicalUrl: string;
  source: {
    id: string;
    type: string;
    packId: string;
  };
  publishedAt: string | null;
  fetchedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  snippet: string | null;
  author: string | null;
  score: number;
  scores: ScoreInfo;
  enrichment?: {
    keyPoints?: string[];
    tags?: string[];
    summary?: string;
  };
  metadata: Record<string, unknown>;
}

export interface ItemsData {
  items: ItemData[];
  sources: SourceInfo[];
}

export interface PackInfo {
  id: string;
  name: string;
  description: string | null;
  keywords: string[];
  sourceCount: number;
  itemCount: number;
  latestItem: string | null;
}

export interface PacksData {
  packs: PackInfo[];
}

export interface HealthData {
  status: "ok" | "error";
  timestamp: string;
  version: string;
  database: {
    connected: boolean;
    itemCount: number;
  };
}
