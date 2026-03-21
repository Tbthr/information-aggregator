/**
 * API 响应类型定义
 */

// 分页元数据
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 查询元数据
export interface QueryMeta {
  packIds: string[];
  window: string;
  sourceIds?: string[];
  sourceTypes?: string[];
  page: number;
  pageSize: number;
  sort: string;
  search?: string;
}

// 时间元数据
export interface TimingMeta {
  generatedAt: string;
  latencyMs: number;
}

// 通用 API 响应
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

// 数据源信息
export interface SourceInfo {
  id: string;
  type: string;
  itemCount: number;
  health: {
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
  };
}

// 内容项
export interface ItemData {
  id: string;
  title: string;
  url: string;
  source: {
    id: string;
    type: string;
  };
  publishedAt: string | null;
  fetchedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  author: string | null;
  score: number;
  saved?: {
    savedAt: string;
  };
  metadata: Record<string, unknown>;

  summary: string | null;
  bullets: string[];
  content: string | null;
  imageUrl: string | null;
  categories: string[];
  sourceName: string;
  isBookmarked: boolean;
}

// Items 列表响应数据
export interface ItemsData {
  items: ItemData[];
  sources: SourceInfo[];
}

// Pack 信息
export interface PackInfo {
  id: string;
  name: string;
  description: string | null;
  sourceCount: number;
  itemCount: number;
  latestItem: string | null;
}

// Packs 列表响应数据
export interface PacksData {
  packs: PackInfo[];
}

// 健康检查响应
export interface HealthData {
  status: "ok" | "error";
  timestamp: string;
  version: string;
  database: {
    connected: boolean;
    itemCount: number;
  };
}
