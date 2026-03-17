import type { MultiDimensionalScore, HighlightsResult } from "../types/index";
import type { FilterJudgment } from "../types/ai-response";
import type { FilterItem, PackContext } from "./prompts-filter";

export interface AiProviderConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface AnthropicConfig {
  authToken: string;
  model: string;
  baseUrl?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

// Gemini API 响应类型
interface GeminiResponsePart {
  text?: string;
}

interface GeminiResponseContent {
  parts: GeminiResponsePart[];
}

interface GeminiResponseCandidate {
  content: GeminiResponseContent;
}

export interface GeminiResponse {
  candidates: GeminiResponseCandidate[];
}

export interface TopicSuggestion {
  title: string;
  description: string;
  sourceLinks: string[];
}

// Daily Brief 文章增强结果
export interface ArticleEnrichResult {
  description: string;
  whyMatters: string;
  tags: string[];
}

// X Analysis 帖子摘要结果
export interface PostSummaryResult {
  summary: string;
  tags: string[];
}

// Daily Brief 整体概览结果
export interface DailyBriefOverviewResult {
  summary: string;
  highlights: string[];
}

export interface AiClient {
  scoreCandidate(prompt: string): Promise<number>;
  summarizeCluster(prompt: string): Promise<string>;
  narrateDigest(prompt: string): Promise<string>;
  suggestTopics(prompt: string): Promise<TopicSuggestion[]>;
  summarizeItem(title: string, snippet: string): Promise<string>;
  // 深度 enrichment 方法
  scoreWithContent(title: string, content: string, url?: string): Promise<number>;
  extractKeyPoints(title: string, content: string, maxPoints?: number): Promise<string[]>;
  generateTags(title: string, content: string, maxTags?: number): Promise<string[]>;
  summarizeContent(title: string, content: string, maxLength?: number): Promise<string>;
  // 多维评分方法
  scoreMultiDimensional(title: string, content: string, url?: string): Promise<MultiDimensionalScore | null>;
  // 趋势洞察
  generateHighlights(titles: string[]): Promise<HighlightsResult | null>;
  // Daily Brief 视图方法
  enrichArticle(title: string, content: string): Promise<ArticleEnrichResult | null>;
  generateDailyBriefOverview(descriptions: string[]): Promise<DailyBriefOverviewResult | null>;
  // X Analysis 视图方法
  summarizePost(title: string, content: string): Promise<PostSummaryResult | null>;
  // 批量过滤判断方法
  batchFilter(items: FilterItem[], packContext: PackContext): Promise<FilterJudgment[]>;
}
