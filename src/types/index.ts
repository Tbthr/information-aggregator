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
  "github_trending",
  "x_home",
  "x_list",
  "x_bookmarks",
  "x_likes",
  // 新增
  "x_user_tweets",
  "x_search",
  "x_trending",
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

// Adapter 函数类型
export type AdapterFn = (source: Source) => Promise<RawItem[]>;

// Pack 定义 - 自包含数据源
export interface SourcePack {
  id: string;
  name: string;
  description?: string;
  keywords?: string[];
  auth?: string;           // auth 引用
  sources: InlineSource[];
  // 模板引用
  promptTemplate?: string;   // 引用 config/prompts/{name}.md
  viewTemplate?: string;     // 引用 config/views/{name}.md
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

export interface RawItemMediaItem {
  type: "photo" | "video" | "animated_gif";
  url: string;
  previewUrl?: string;
}

export interface RawItemArticle {
  title: string;
  url: string;
  previewText?: string;
}

export interface RawItemQuote {
  id?: string;
  text?: string;
  author?: string;
  url?: string;
}

export interface RawItemThreadItem {
  id?: string;
  text?: string;
  author?: string;
}

export interface RawItemMetadata {
  provider: string;
  sourceType: SourceType;
  contentType: string;
  engagement?: RawItemEngagement;
  canonicalHints?: RawItemCanonicalHints;
  subreddit?: string;
  discoveredFrom?: string;
  // X Analysis 扩展字段
  media?: RawItemMediaItem[];
  article?: RawItemArticle;
  quote?: RawItemQuote;
  thread?: RawItemThreadItem[];
  // 新增字段
  tweetId?: string;           // 推文 ID
  authorId?: string;          // 作者 ID
  authorName?: string;        // 作者显示名
  expandedUrl?: string;       // 展开的外链 URL
  conversationId?: string;    // 对话 ID
  parent?: RawItemThreadItem; // 父推文（回复上下文）
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
  metadataJson?: string;  // 原始元数据 JSON
  author?: string;        // 作者信息
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
  multiScore?: MultiDimensionalScore;  // 多维评分
}

/**
 * 多维评分系统
 * 从相关性、质量、时效性三个维度评估内容
 */
export interface MultiDimensionalScore {
  relevance: number;    // 相关性 1-10
  quality: number;      // 质量 1-10
  timeliness: number;   // 时效性 1-10
  total: number;        // 总分（加权平均）
  reason: string;       // 评价理由
}

/**
 * 趋势洞察结果
 * AI 生成的趋势总结和主要趋势
 */
export interface HighlightsResult {
  summary: string;       // 3-5 句话的趋势总结
  trends: string[];      // 2-3 个主要趋势
  generatedAt: string;   // 生成时间
}

/**
 * enrichment 配置
 */
export interface EnrichmentConfig {
  enableContentExtraction?: boolean;    // 是否启用正文提取，默认 true
  contentExtractionLimit?: number;      // 正文提取数量限制，默认 5
  contentExtractionTimeout?: number;    // 正文提取超时（毫秒），默认 15000
  extractionConcurrency?: number;       // 正文提取并发数，默认 3
  extractionBatchSize?: number;         // 正文提取批次大小，默认 5
  enableKeyPoints?: boolean;            // 是否启用关键点提取，默认 true
  enableTagging?: boolean;              // 是否启用标签生成，默认 true
  cacheEnabled?: boolean;               // 是否启用缓存，默认 true
  cacheTtl?: number;                    // 缓存 TTL（秒），默认 86400
  maxContentLength?: number;            // 最大内容长度（字符数），默认不限制
  aiBatchSize?: number;                 // AI 批处理大小，默认 5
  aiConcurrency?: number;               // AI 并发数，默认 2
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
  "x-analysis",
]);
