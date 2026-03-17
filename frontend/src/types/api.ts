/**
 * API 响应类型定义（与后端 src/api/types.ts 保持同步）
 */

/**
 * 策略模式
 * - assist_only: 仅 AI 辅助处理
 * - filter_then_assist: 先过滤再 AI 辅助
 */
export type PolicyMode = 'assist_only' | 'filter_then_assist';

/**
 * AI 过滤判断结果
 * 用于记录 AI 对条目是否保留的判断及其理由
 */
export interface FilterJudgment {
  /** 是否保留该条目 */
  keepDecision: boolean;
  /** 保留/丢弃的理由 */
  keepReason: string;
  /** 读者收益（可选）：说明该条目对读者的价值 */
  readerBenefit?: string;
  /** 阅读提示（可选）：帮助读者快速理解条目内容的提示 */
  readingHint?: string;
  /** 判断时间戳（ISO 8601 格式） */
  judgedAt: string;
}

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
  policy?: {
    mode: PolicyMode;
  };
  filterJudgment?: FilterJudgment;
  saved?: {
    savedAt: string;
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

/**
 * 简化的内容项格式（用于 Daily Brief）
 */
export interface BriefItem {
  id: string;
  title: string;
  url: string;
  source: {
    id: string;
    type: string;
    packId: string;
  };
  publishedAt: string | null;
  fetchedAt: string;
  snippet: string | null;
  author: string | null;
  score: number;
  scores: ScoreInfo;
}

/**
 * Daily Brief 响应结构
 */
export interface DailyBriefData {
  coverStory: BriefItem | null;
  leadStories: BriefItem[];
  topSignals: BriefItem[];
  scanBrief: Array<{ id: string; title: string; url: string; score: number }>;
  savedForLater: BriefItem[];
  meta: {
    generatedAt: string;
    totalItems: number;
    keptItems: number;
    retentionRate: number;
  };
}

/**
 * Pack 级别策略配置
 */
export interface PackPolicy {
  mode: PolicyMode;
  filterPrompt?: string;
}

/**
 * Pack 详情响应结构
 */
export interface PackDetailData {
  pack: PackInfo;
  policy: PackPolicy;
  stats: {
    sourceCount: number;
    totalItems: number;
    retainedItems: number;
    retentionRate: number;
  };
  sourceComposition: Record<string, number>;
  featuredItems: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string | null;
    author: string | null;
    publishedAt: string | null;
    score: number;
  }>;
  sources: Array<{
    type: string;
    url: string;
    description?: string;
    enabled: boolean;
  }>;
}

/**
 * Weekly Review 响应结构
 */
export interface WeeklyReviewData {
  overview: {
    totalCount: number;
    retainedCount: number;
    retentionRate: number;
    windowStart: string;
    windowEnd: string;
  };
  topics: Array<{
    name: string;
    tags: string[];
    keywords: string[];
    items: Array<{
      id: string;
      title: string;
      url: string;
      snippet?: string;
      publishedAt?: string;
      tags?: string[];
    }>;
    count: number;
  }>;
  editorPicks: Array<{
    id: string;
    itemId: string;
    savedAt: string;
    title: string;
    url: string;
    packId?: string;
  }>;
  itemsByDate: Record<string, Array<{
    id: string;
    title: string;
    url: string;
    publishedAt?: string;
  }>>;
}
