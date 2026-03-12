export type RunKind = "query";
export type OutputFormat = "markdown" | "json";
export type QuerySort = "ranked" | "recent" | "engagement";
export type CanonicalRelationship = "original" | "discussion" | "share";
export const CANONICAL_SOURCE_TYPES = [
  "rss",
  "json-feed",
  "website",
  "hn",
  "reddit",
  "digest_feed",
  "github_trending",
  "x_home",
  "x_list",
  "x_bookmarks",
  "x_likes",
] as const;

export type SourceType = (typeof CANONICAL_SOURCE_TYPES)[number];
export type RunStatus = "pending" | "running" | "completed" | "failed" | "succeeded";

// 内联数据源定义
export interface InlineSource {
  type: SourceType;
  url: string;
  description?: string;
  enabled?: boolean;
  configJson?: string;
}

// Source 类型别名，用于 adapter 函数签名
export type Source = InlineSource & { id: string };

// Pack 定义 - 自包含数据源
export interface SourcePack {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
  sources: InlineSource[];
}

export interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  fetchedAt: string;
  metadataJson: string;
  snippet?: string;
  publishedAt?: string;
  author?: string;
}

export interface RawItemEngagement {
  score?: number;
  comments?: number;
  reactions?: number;
}

export interface RawItemCanonicalHints {
  externalUrl?: string;
  discussionUrl?: string;
  linkedUrl?: string;
  expandedUrl?: string;
}

export interface RawItemMetadata {
  provider: string;
  sourceType: SourceType;
  contentType: string;
  engagement?: RawItemEngagement;
  canonicalHints?: RawItemCanonicalHints;
  subreddit?: string;
  discoveredFrom?: string;
}

export interface NormalizedItem {
  id: string;
  rawItemId: string;
  canonicalUrl: string;
  linkedCanonicalUrl?: string;
  relationshipToCanonical?: CanonicalRelationship;
  isDiscussionSource?: boolean;
  normalizedTitle: string;
  normalizedSnippet?: string;
  normalizedText?: string;
  exactDedupKey?: string;
  processedAt?: string;
  sourceId?: string;
  title?: string;
  url?: string;
  metadataJson?: string;
  sourceType?: SourceType;
  contentType?: string;
  engagementScore?: number;
}

export interface Cluster {
  id: string;
  canonicalItemId: string;
  memberItemIds: string[];
  dedupeMethod: "exact" | "near";
  runId?: string;
  title?: string;
  summary?: string;
  url?: string;
}

export interface RunRecord {
  id: string;
  kind: RunKind;
  startedAt?: string;
  createdAt?: string;
  finishedAt?: string;
  status: RunStatus;
  sourceSelectionJson?: string;
  paramsJson?: string;
}

export interface OutputRecord {
  id: string;
  runId: string;
  kind: RunKind;
  format: "markdown" | "json";
  body: string;
  createdAt: string;
}


export interface SourceHealth {
  sourceId: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastError?: string | null;
  lastFetchLatencyMs?: number | null;
  lastItemCount?: number | null;
  errorCount: number;
  consecutiveFailures?: number;
  consecutiveZeroItemRuns: number;
}

export interface TopicRule {
  includeKeywords?: string[];
  excludeKeywords?: string[];
  preferredSources?: string[];
  blockedSources?: string[];
}

export interface RankedCandidate {
  id: string;
  title?: string;
  url?: string;
  sourceId?: string;
  sourceName?: string;
  normalizedTitle?: string;
  normalizedText?: string;
  canonicalUrl?: string;
  processedAt?: string;
  sourceWeightScore: number;
  freshnessScore: number;
  engagementScore: number;
  topicMatchScore: number;
  contentQualityAi: number;
  linkedCanonicalUrl?: string;
  relationshipToCanonical?: CanonicalRelationship;
  isDiscussionSource?: boolean;
  finalScore?: number;
  rationale?: string;
  contentType?: string;
  sourceType?: SourceType;
  // 深度 enrichment 相关字段
  extractedContent?: ExtractedContent;
  aiEnrichment?: AiEnrichmentResult;
}

/**
 * 提取的正文内容
 */
export interface ExtractedContent {
  url: string;
  title?: string;
  content?: string;        // HTML 清理后的正文
  textContent?: string;    // 纯文本正文
  excerpt?: string;        // 摘要段落
  length?: number;         // 正文长度
  extractedAt: string;
  error?: string;
}

/**
 * AI 增强结果
 */
export interface AiEnrichmentResult {
  keyPoints?: string[];    // 关键点（3-5 个）
  tags?: string[];         // 自动生成的标签
  summary?: string;        // AI 摘要
  score?: number;          // 基于完整内容的质量评分
}

/**
 * enrichment 配置
 */
export interface EnrichmentConfig {
  enableContentExtraction?: boolean;    // 是否启用正文提取，默认 true
  contentExtractionLimit?: number;      // 正文提取数量限制，默认 5
  contentExtractionTimeout?: number;    // 正文提取超时（毫秒），默认 15000
  enableKeyPoints?: boolean;            // 是否启用关键点提取，默认 true
  enableTagging?: boolean;              // 是否启用标签生成，默认 true
  cacheEnabled?: boolean;               // 是否启用缓存，默认 true
  cacheTtl?: number;                    // 缓存 TTL（秒），默认 86400
  maxContentLength?: number;            // 最大内容长度（字符数），默认不限制
}

export function parseRawItemMetadata(metadataJson: string | undefined): RawItemMetadata | null {
  if (typeof metadataJson !== "string" || metadataJson.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson) as RawItemMetadata | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// CLI 运行参数
export interface ParsedRunArgs {
  packIds: string[];
  viewId: string;
  window: string;
  outputFile?: string;
  noAi?: boolean;
}

// 授权配置
export interface AuthConfig {
  adapter: string;
  config: Record<string, unknown>;
}

// 内置视图列表
export const BUILTIN_VIEWS = new Set([
  "json",
  "daily-brief",
  "item-list",
  "x-bookmarks-analysis",
  "x-likes-analysis",
  "x-longform-hot",
  "x-bookmarks-digest",
]);
