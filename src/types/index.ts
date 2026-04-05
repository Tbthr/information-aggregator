export type RunKind = "query";
export type QuerySort = "ranked" | "recent" | "engagement";
export type RunStatus = "pending" | "running" | "completed" | "failed" | "succeeded";

// Source and content types
export type SourceType = 'rss' | 'x' | 'json-feed' | 'github-trending' | 'zeli' | 'attentionvc' | 'clawfeed' | 'github';
export type ContentType = 'article' | 'tweet' | 'github';
export type AdapterType = 'hexi-daily' | 'juya-daily' | 'clawfeed-daily';

// Adapter type constants
export const ADAPTER_TYPES = {
  JSON_FEED: 'json-feed',
  RSS: 'rss',
  X: 'x',
  ZELI: 'zeli',
  ATTENTIONVC: 'attentionvc',
  CLAWFEED: 'clawfeed',
} as const;

// Content kinds for unified content model
export const CONTENT_KINDS = ["article", "tweet", "video", "github", "reddit", "hackernews"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

// Tag model fields (renamed from Topic)
export interface Tag {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  includeRules: string[];
  excludeRules: string[];
  scoreBoost: number;
}

// TagScores map for stable object mapping
export type TagScores = Record<string, number>; // tagId -> score

// Source 类型，用于 adapter 函数签名
export interface Source {
  type: SourceType;
  id: string;
  name: string;
  description?: string;
  url: string;
  enabled: boolean;
  tagIds: string[];
  weightScore: number | null;
  contentType: ContentType;
  authConfigJson: string | null;
  sourceWeightScore: number;
}

// Shared interface for parseItems functions
export interface ParseItemsOptions {
  jobStartedAt: string;
  timeWindow: number;
  source: Source;
}

// Adapter 函数类型
export type AdapterFn = (source: Source, options: { timeWindow: number }) => Promise<RawItem[]>;

// RawItemEngagement
export interface RawItemEngagement {
  likes?: number;
  comments?: number;
  reactions?: number;
  shares?: number;
}

// RawItemCanonicalHints
export interface RawItemCanonicalHints {
  hnDiscussion?: string;
  redditDiscussion?: string;
}

// RawItem - 采集最小标准化结果，仅用于进入 normalize
export interface RawItem {
  id: string;
  sourceId: string;
  sourceType: string;
  contentType: string;
  title: string;
  url: string;
  author?: string;
  content?: string;
  summary?: string;
  engagement?: RawItemEngagement;
  expandedUrl?: string;
  canonicalHints?: RawItemCanonicalHints;
  sourceName: string;
  publishedAt: string;
  fetchedAt: string;
  metadataJson: string;
  tagFilter?: string[];
}

// NormalizedItem - simplified article-only output from normalize.ts
export interface NormalizedItem {
  id: string;
  sourceId: string;
  title: string;
  publishedAt?: string;
  sourceType: string;
  contentType: "article"; // fixed to article per spec
  normalizedUrl: string;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  metadataJson: string;
}

// normalizedArticle - pipeline 中统一使用的文章类型
export interface normalizedArticle {
  id: string;
  sourceId: string;
  sourceName?: string;      // 来源名称，用于日报展示
  title: string;
  publishedAt?: string;
  sourceType: string;
  contentType: "article";
  normalizedUrl: string;
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  metadataJson: string;
  // Pipeline 运行时字段
  sourceWeightScore: number;
  engagementScore: number;
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
  tagIds: string[];
  tagScoresJson?: string;
  metadataJson?: string;
}

// Content discriminated union for kind-specific handling
export type ArticleContent = Content & { kind: "article"; body: string };
export type TweetContent = Content & { kind: "tweet"; body: string };
export type VideoContent = Content & { kind: "video"; body?: string };
export type GitHubContent = Content & { kind: "github"; body?: string };
export type RedditContent = Content & { kind: "reddit"; body?: string };
export type HackerNewsContent = Content & { kind: "hackernews"; body?: string };

// FilterableItem - for filter-by-tag.ts
export interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  engagementScore?: number | null;
  tagIds?: string[];
}

// ReportCandidate - 日报阶段统一候选模型（基于 Content，不是数据库表）
export interface ReportCandidate {
  id: string;
  kind: ContentKind;
  tagId: string; // Primary tag this candidate belongs to
  tagScores?: TagScores; // Scores across all matched tags
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
  // Quadrant-aware pipeline fields
  tagIds?: string[]; // Content.tagIds copy for preset Tag grouping
  sourceType?: string; // Source.type this content was collected from
  freshnessTier?: "热点" | "趋势" | "经典";
  productivityDistance?: "近" | "中" | "远";
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
  sourceWeightScore: number;
  freshnessScore: number;
  engagementScore: number;
  contentQualityAi: number;
  finalScore?: number;
  rationale?: string;
  sourceType?: string;
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
  enableTagging?: boolean;             // 是否启用标签生成，默认 true
  cacheEnabled?: boolean;              // 是否启用缓存，默认 true
  cacheTtl?: number;                    // 缓存 TTL（秒），默认 86400
  maxContentLength?: number;            // 最大内容长度（字符数），默认不限制
  aiBatchSize?: number;                 // AI 批处理大小，默认 5
  aiConcurrency?: number;               // AI 并发数，默认 2
}
