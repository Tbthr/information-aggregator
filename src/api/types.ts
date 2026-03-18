/**
 * API 响应类型定义
 */

import type { PolicyMode } from '../types/policy.js';
import type { FilterJudgment } from '../types/ai-response.js';

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
  packId: string;
  itemCount: number;
  health: {
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
  };
}

// 评分信息
export interface ScoreInfo {
  sourceWeight: number;
  freshness: number;
  engagement: number;
  contentQuality: number;
}

// 内容项
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
  policy?: {
    mode: PolicyMode;
  };
  filterJudgment?: FilterJudgment;
  saved?: {
    savedAt: string;
  };
  metadata: Record<string, unknown>;
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
