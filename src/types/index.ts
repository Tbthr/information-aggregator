export type RunKind = "query";
export type QuerySort = "ranked" | "recent" | "engagement";
export type CanonicalRelationship = "original" | "discussion" | "share";
export const CANONICAL_SOURCE_KINDS = [
  "rss",
  "json-feed",
  "website",
  "hn",
  "reddit",
  "github-trending",
  "x",
  "youtube",
] as const;

export type SourceKind = (typeof CANONICAL_SOURCE_KINDS)[number];
export type RunStatus = "pending" | "running" | "completed" | "failed" | "succeeded";

// Content kinds for unified content model
export const CONTENT_KINDS = ["article", "tweet", "video", "github", "reddit", "hackernews"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

// Topic model fields (mirrors Prisma Topic)
export interface Topic {
  id: string;
  name: string;
  description?: string;
  includeRules: string[];
  excludeRules: string[];
  scoreBoost: number;
  displayOrder: number;
  maxItems: number;
}

// TopicScores map for stable object mapping
export type TopicScores = Record<string, number>; // topicId -> score

// 内联数据源定义 (kind replaces type)
export interface InlineSource {
  kind: SourceKind;
  url: string;
  description?: string;
  enabled?: boolean;
  configJson?: string;
  // NEW: topic-centric config
  priority?: number;
  defaultTopicIds?: string[];
  authRef?: string;
}

// Source 类型别名，用于 adapter 函数签名
export type Source = InlineSource & { id: string };

// Adapter 函数类型
export type AdapterFn = (source: Source) => Promise<RawItem[]>;

// FilterContext - runtime context for filtering items (topic-centric for migration)
export interface FilterContext {
  topicIds: string[]; // Topics to filter by (replaces packId)
  mustInclude?: string[];
  exclude?: string[];
}

// Topic-centric classification context
export interface ClassificationContext {
  topics: Topic[];
  sourceKind?: SourceKind;
  timeRange?: {
    start: string;
    end: string;
  };
}

// RawItem - 采集最小标准化结果，仅用于进入 normalize
export interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  fetchedAt: string;
  metadataJson: string;
  publishedAt?: string;
  // Runtime filter context (not stored in DB, set at collection time)
  filterContext?: FilterContext;
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
  sourceKind: SourceKind;
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
  content?: string;           // 正文内容
  expandedUrl?: string;       // 展开的外链 URL
  conversationId?: string;    // 对话 ID
  parent?: RawItemThreadItem; // 父推文（回复上下文）
}

// NormalizedItem - simplified article-only output from normalize.ts
export interface NormalizedItem {
  id: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
  sourceKind: SourceKind;
  contentType: "article"; // fixed to article per spec
  normalizedUrl: string;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  metadataJson: string;
  // Runtime filter context (not stored in DB, set at collection time)
  filterContext?: FilterContext;
  // Legacy fields (deprecated, will be removed per Task 9)
  rawItemId?: string;
  canonicalUrl?: string;
  linkedCanonicalUrl?: string;
  relationshipToCanonical?: CanonicalRelationship;
  isDiscussionSource?: boolean;
  normalizedText?: string;
  exactDedupKey?: string;
  processedAt?: string;
  url?: string;
  engagementScore?: number;
  content?: string;
}

// Content - unified content model for normalized items
export interface Content {
  id: string;
  kind: ContentKind;
  sourceId: string;
  title: string;
  body?: string;
  url: string;
  authorLabel?: string;
  publishedAt?: string;
  fetchedAt: string;
  engagementScore?: number;
  qualityScore?: number;
  topicIds: string[];
  topicScoresJson?: string;
  metadataJson?: string;
}

// Content discriminated union for kind-specific handling
export type ArticleContent = Content & { kind: "article"; body: string };
export type TweetContent = Content & { kind: "tweet"; body: string };
export type VideoContent = Content & { kind: "video"; body?: string };
export type GitHubContent = Content & { kind: "github"; body?: string };
export type RedditContent = Content & { kind: "reddit"; body?: string };
export type HackerNewsContent = Content & { kind: "hackernews"; body?: string };

// ReportCandidate - 日报阶段统一候选模型（基于 Content，不是数据库表）
export interface ReportCandidate {
  id: string;
  kind: ContentKind;
  topicId: string; // Primary topic this candidate belongs to
  topicScores?: TopicScores; // Scores across all matched topics
  title: string;
  summary: string;
  content: string;
  url: string;
  authorLabel?: string;
  publishedAt?: string;
  sourceLabel: string;
  categories?: string[];
  normalizedUrl: string;
  normalizedTitle: string;
  engagementScore?: number;
  qualityScore?: number;
  // rawRef is used to reference the original raw item
  rawRef: {
    id: string;
    sourceId: string;
  };
}

// Score breakdown types for runtime scoring
export interface SignalScores {
  freshness?: number;
  engagement?: number;
  quality?: number;
  sourceWeight?: number;
}

export interface ScoreBreakdown {
  baseScore: number;
  signalScores: SignalScores;
  runtimeScore: number;
  historyPenalty: number;
  finalScore: number;
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
  contentQualityAi: number;
  linkedCanonicalUrl?: string;
  relationshipToCanonical?: CanonicalRelationship;
  isDiscussionSource?: boolean;
  finalScore?: number;
  rationale?: string;
  contentType?: string;
  sourceKind?: SourceKind;
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
