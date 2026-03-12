import type { MultiDimensionalScore, HighlightsResult } from "../types/index";
import {
  buildDeepQualityPrompt,
  buildKeyPointsPrompt,
  buildTaggingPrompt,
  buildSummaryPrompt,
  buildMultiDimensionalScorePrompt,
} from "./prompts-enrichment";
import { buildHighlightsPrompt } from "./prompts-highlights";
import {
  buildArticleEnrichPrompt,
  buildDailyBriefOverviewPrompt,
  parseArticleEnrichResult,
  parseDailyBriefOverviewResult,
} from "./prompts-daily-brief";
import {
  buildPostSummaryPrompt,
  parsePostSummaryResult,
} from "./prompts-x-analysis";

// 默认模型常量
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

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

interface GeminiResponse {
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
}

function getFetchImpl(fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return fetchFn ?? fetch;
}

function getBaseUrl(config: AiProviderConfig): string {
  return (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

function getOpenAiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid AI response payload");
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim() !== "") {
    return record.output_text.trim();
  }

  const output = record.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim() !== "") {
          return text.trim();
        }
      }
    }
  }

  throw new Error("AI response did not contain output text");
}

function getAnthropicResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Anthropic response payload");
  }

  const record = payload as Record<string, unknown>;
  const content = record.content;

  if (!Array.isArray(content)) {
    throw new Error("Anthropic response did not contain content array");
  }

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const blockRecord = block as Record<string, unknown>;
    if (blockRecord.type === "text" && typeof blockRecord.text === "string") {
      const text = blockRecord.text.trim();
      if (text !== "") {
        return text;
      }
    }
  }

  throw new Error("Anthropic response did not contain text content");
}

function getGeminiResponseText(payload: unknown): string {
  const response = payload as GeminiResponse;

  if (!response || !Array.isArray(response.candidates) || response.candidates.length === 0) {
    throw new Error("Gemini response did not contain candidates");
  }

  const firstCandidate = response.candidates[0];
  if (!firstCandidate?.content?.parts?.length) {
    throw new Error("Gemini response structure is invalid");
  }

  const firstPart = firstCandidate.content.parts[0];
  const text = firstPart?.text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Gemini response did not contain text");
  }

  return text.trim();
}

function parseScore(payload: unknown, responseParser: (p: unknown) => string): number {
  const text = responseParser(payload);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    throw new Error(`AI score response did not contain a number: ${text}`);
  }

  return Number(match[0]);
}

function parseTopicSuggestions(text: string): TopicSuggestion[] {
  // 尝试从文本中提取 JSON
  const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { suggestions?: Array<{ title?: string; description?: string; sourceIndices?: number[] }> };
    if (!Array.isArray(parsed.suggestions)) {
      return [];
    }

    return parsed.suggestions
      .filter((s): s is { title: string; description: string; sourceIndices?: number[] } =>
        typeof s.title === "string" && typeof s.description === "string")
      .map((s) => ({
        title: s.title,
        description: s.description,
        sourceLinks: Array.isArray(s.sourceIndices) ? s.sourceIndices.map(String) : [],
      }));
  } catch {
    return [];
  }
}

/**
 * 从 AI 响应中解析 JSON 对象
 */
function parseJsonObject(text: string): Record<string, unknown> | null {
  // 尝试提取 JSON 对象（处理可能的 markdown 代码块）
  let cleaned = text.trim();

  // 移除 markdown 代码块标记
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/, "");

  // 尝试找到最外层的 JSON 对象
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 从 JSON 对象中提取字符串数组
 */
function parseStringArray(obj: Record<string, unknown>, key: string): string[] {
  const value = obj[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * 从 JSON 对象中提取数字
 */
function parseNumber(obj: Record<string, unknown>, key: string): number | null {
  const value = obj[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * 从 JSON 对象中提取字符串
 */
function parseString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (typeof value === "string") {
    return value;
  }
  return null;
}

/**
 * 解析 Highlights 结果
 */
function parseHighlightsResult(obj: Record<string, unknown>): HighlightsResult | null {
  const summary = parseString(obj, "summary");
  const trends = obj.trends;

  if (typeof summary !== "string" || !Array.isArray(trends)) {
    return null;
  }

  return {
    summary,
    trends: trends.filter((t): t is string => typeof t === "string"),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 解析多维评分结果
 */
function parseMultiDimensionalScore(obj: Record<string, unknown>): MultiDimensionalScore | null {
  const relevance = parseNumber(obj, "relevance");
  const quality = parseNumber(obj, "quality");
  const timeliness = parseNumber(obj, "timeliness");
  const total = parseNumber(obj, "total");
  const reason = parseString(obj, "reason");

  if (relevance === null || quality === null || timeliness === null || total === null) {
    return null;
  }

  return {
    relevance,
    quality,
    timeliness,
    total,
    reason: reason ?? "",
  };
}

class ProviderAiClient implements AiClient {
  constructor(private readonly config: Required<Pick<AiProviderConfig, "apiKey" | "model">> & AiProviderConfig) {}

  private async request(prompt: string): Promise<unknown> {
    const response = await getFetchImpl(this.config.fetch)(`${getBaseUrl(this.config)}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed: ${response.status}`);
    }

    return response.json();
  }

  async scoreCandidate(prompt: string): Promise<number> {
    return parseScore(await this.request(prompt), getOpenAiResponseText);
  }

  async summarizeCluster(prompt: string): Promise<string> {
    return getOpenAiResponseText(await this.request(prompt));
  }

  async narrateDigest(prompt: string): Promise<string> {
    return getOpenAiResponseText(await this.request(prompt));
  }

  async suggestTopics(prompt: string): Promise<TopicSuggestion[]> {
    const text = getOpenAiResponseText(await this.request(prompt));
    return parseTopicSuggestions(text);
  }

  async summarizeItem(title: string, snippet: string): Promise<string> {
    return getOpenAiResponseText(await this.request(`${title}\n\n${snippet}`));
  }

  // 深度 enrichment 方法

  async scoreWithContent(title: string, content: string, url?: string): Promise<number> {
    const prompt = buildDeepQualityPrompt(title, content, url);
    const response = getOpenAiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    const score = parsed ? parseNumber(parsed, "score") : null;
    return score ?? 0;
  }

  async extractKeyPoints(title: string, content: string, maxPoints = 5): Promise<string[]> {
    const prompt = buildKeyPointsPrompt(title, content, maxPoints);
    const response = getOpenAiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "keyPoints") : [];
  }

  async generateTags(title: string, content: string, maxTags = 5): Promise<string[]> {
    const prompt = buildTaggingPrompt(title, content, maxTags);
    const response = getOpenAiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "tags") : [];
  }

  async summarizeContent(title: string, content: string, maxLength = 150): Promise<string> {
    const prompt = buildSummaryPrompt(title, content, maxLength);
    return getOpenAiResponseText(await this.request(prompt));
  }

  // 多维评分方法
  async scoreMultiDimensional(title: string, content: string, url?: string): Promise<MultiDimensionalScore | null> {
    const prompt = buildMultiDimensionalScorePrompt(title, content, url);
    const response = getOpenAiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseMultiDimensionalScore(parsed) : null;
  }

  // 趋势洞察方法
  async generateHighlights(titles: string[]): Promise<HighlightsResult | null> {
    const prompt = buildHighlightsPrompt(titles);
    const response = getOpenAiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseHighlightsResult(parsed) : null;
  }

  // Daily Brief 方法
  async enrichArticle(title: string, content: string): Promise<ArticleEnrichResult | null> {
    const prompt = buildArticleEnrichPrompt(title, content);
    const response = getOpenAiResponseText(await this.request(prompt));
    return parseArticleEnrichResult(response);
  }

  async generateDailyBriefOverview(descriptions: string[]): Promise<DailyBriefOverviewResult | null> {
    const prompt = buildDailyBriefOverviewPrompt(descriptions);
    const response = getOpenAiResponseText(await this.request(prompt));
    return parseDailyBriefOverviewResult(response);
  }

  // X Analysis 方法
  async summarizePost(title: string, content: string): Promise<PostSummaryResult | null> {
    const prompt = buildPostSummaryPrompt(title, content);
    const response = getOpenAiResponseText(await this.request(prompt));
    return parsePostSummaryResult(response);
  }
}

class AnthropicClient implements AiClient {
  constructor(private readonly config: AnthropicConfig) {}

  private async request(prompt: string): Promise<unknown> {
    const baseUrl = (this.config.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
    const response = await getFetchImpl(this.config.fetch)(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.authToken,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }

    return response.json();
  }

  async scoreCandidate(prompt: string): Promise<number> {
    return parseScore(await this.request(prompt), getAnthropicResponseText);
  }

  async summarizeCluster(prompt: string): Promise<string> {
    return getAnthropicResponseText(await this.request(prompt));
  }

  async narrateDigest(prompt: string): Promise<string> {
    return getAnthropicResponseText(await this.request(prompt));
  }

  async suggestTopics(prompt: string): Promise<TopicSuggestion[]> {
    const text = getAnthropicResponseText(await this.request(prompt));
    return parseTopicSuggestions(text);
  }

  async summarizeItem(title: string, snippet: string): Promise<string> {
    return getAnthropicResponseText(await this.request(`${title}\n\n${snippet}`));
  }

  // 深度 enrichment 方法

  async scoreWithContent(title: string, content: string, url?: string): Promise<number> {
    const prompt = buildDeepQualityPrompt(title, content, url);
    const response = getAnthropicResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    const score = parsed ? parseNumber(parsed, "score") : null;
    return score ?? 0;
  }

  async extractKeyPoints(title: string, content: string, maxPoints = 5): Promise<string[]> {
    const prompt = buildKeyPointsPrompt(title, content, maxPoints);
    const response = getAnthropicResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "keyPoints") : [];
  }

  async generateTags(title: string, content: string, maxTags = 5): Promise<string[]> {
    const prompt = buildTaggingPrompt(title, content, maxTags);
    const response = getAnthropicResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "tags") : [];
  }

  async summarizeContent(title: string, content: string, maxLength = 150): Promise<string> {
    const prompt = buildSummaryPrompt(title, content, maxLength);
    return getAnthropicResponseText(await this.request(prompt));
  }

  // 多维评分方法
  async scoreMultiDimensional(title: string, content: string, url?: string): Promise<MultiDimensionalScore | null> {
    const prompt = buildMultiDimensionalScorePrompt(title, content, url);
    const response = getAnthropicResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseMultiDimensionalScore(parsed) : null;
  }

  // 趋势洞察方法
  async generateHighlights(titles: string[]): Promise<HighlightsResult | null> {
    const prompt = buildHighlightsPrompt(titles);
    const response = getAnthropicResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseHighlightsResult(parsed) : null;
  }

  // Daily Brief 方法
  async enrichArticle(title: string, content: string): Promise<ArticleEnrichResult | null> {
    const prompt = buildArticleEnrichPrompt(title, content);
    const response = getAnthropicResponseText(await this.request(prompt));
    return parseArticleEnrichResult(response);
  }

  async generateDailyBriefOverview(descriptions: string[]): Promise<DailyBriefOverviewResult | null> {
    const prompt = buildDailyBriefOverviewPrompt(descriptions);
    const response = getAnthropicResponseText(await this.request(prompt));
    return parseDailyBriefOverviewResult(response);
  }

  // X Analysis 方法
  async summarizePost(title: string, content: string): Promise<PostSummaryResult | null> {
    const prompt = buildPostSummaryPrompt(title, content);
    const response = getAnthropicResponseText(await this.request(prompt));
    return parsePostSummaryResult(response);
  }
}

class GeminiClient implements AiClient {
  private readonly model: string;

  constructor(private readonly config: GeminiConfig) {
    this.model = config.model ?? DEFAULT_GEMINI_MODEL;
  }

  private async request(prompt: string): Promise<unknown> {
    const baseUrl = (this.config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta/models").replace(/\/+$/, "");
    const url = `${baseUrl}/${this.model}:generateContent?key=${this.config.apiKey}`;

    const response = await getFetchImpl(this.config.fetch)(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status}`);
    }

    return response.json();
  }

  async scoreCandidate(prompt: string): Promise<number> {
    return parseScore(await this.request(prompt), getGeminiResponseText);
  }

  async summarizeCluster(prompt: string): Promise<string> {
    return getGeminiResponseText(await this.request(prompt));
  }

  async narrateDigest(prompt: string): Promise<string> {
    return getGeminiResponseText(await this.request(prompt));
  }

  async suggestTopics(prompt: string): Promise<TopicSuggestion[]> {
    const text = getGeminiResponseText(await this.request(prompt));
    return parseTopicSuggestions(text);
  }

  async summarizeItem(title: string, snippet: string): Promise<string> {
    return getGeminiResponseText(await this.request(`${title}\n\n${snippet}`));
  }

  // 深度 enrichment 方法

  async scoreWithContent(title: string, content: string, url?: string): Promise<number> {
    const prompt = buildDeepQualityPrompt(title, content, url);
    const response = getGeminiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    const score = parsed ? parseNumber(parsed, "score") : null;
    return score ?? 0;
  }

  async extractKeyPoints(title: string, content: string, maxPoints = 5): Promise<string[]> {
    const prompt = buildKeyPointsPrompt(title, content, maxPoints);
    const response = getGeminiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "keyPoints") : [];
  }

  async generateTags(title: string, content: string, maxTags = 5): Promise<string[]> {
    const prompt = buildTaggingPrompt(title, content, maxTags);
    const response = getGeminiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "tags") : [];
  }

  async summarizeContent(title: string, content: string, maxLength = 150): Promise<string> {
    const prompt = buildSummaryPrompt(title, content, maxLength);
    return getGeminiResponseText(await this.request(prompt));
  }

  // 多维评分方法
  async scoreMultiDimensional(title: string, content: string, url?: string): Promise<MultiDimensionalScore | null> {
    const prompt = buildMultiDimensionalScorePrompt(title, content, url);
    const response = getGeminiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseMultiDimensionalScore(parsed) : null;
  }

  // 趋势洞察方法
  async generateHighlights(titles: string[]): Promise<HighlightsResult | null> {
    const prompt = buildHighlightsPrompt(titles);
    const response = getGeminiResponseText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseHighlightsResult(parsed) : null;
  }

  // Daily Brief 方法
  async enrichArticle(title: string, content: string): Promise<ArticleEnrichResult | null> {
    const prompt = buildArticleEnrichPrompt(title, content);
    const response = getGeminiResponseText(await this.request(prompt));
    return parseArticleEnrichResult(response);
  }

  async generateDailyBriefOverview(descriptions: string[]): Promise<DailyBriefOverviewResult | null> {
    const prompt = buildDailyBriefOverviewPrompt(descriptions);
    const response = getGeminiResponseText(await this.request(prompt));
    return parseDailyBriefOverviewResult(response);
  }

  // X Analysis 方法
  async summarizePost(title: string, content: string): Promise<PostSummaryResult | null> {
    const prompt = buildPostSummaryPrompt(title, content);
    const response = getGeminiResponseText(await this.request(prompt));
    return parsePostSummaryResult(response);
  }
}

export function createAiClient(config: AiProviderConfig): AiClient | null {
  if (!config.provider || !config.apiKey || !config.model) {
    return null;
  }

  return new ProviderAiClient({
    ...config,
    apiKey: config.apiKey,
    model: config.model,
  });
}

export function createAnthropicClient(config?: Partial<AnthropicConfig>): AiClient | null {
  const authToken = config?.authToken ?? process.env.ANTHROPIC_AUTH_TOKEN;
  const model = config?.model ?? process.env.ANTHROPIC_MODEL;
  const baseUrl = config?.baseUrl ?? process.env.ANTHROPIC_BASE_URL;

  if (!authToken || !model) {
    return null;
  }

  return new AnthropicClient({
    authToken,
    model,
    baseUrl,
    fetch: config?.fetch,
  });
}

export function createGeminiClient(config?: Partial<GeminiConfig>): AiClient | null {
  const apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY;
  const model = config?.model ?? process.env.GEMINI_MODEL;
  const baseUrl = config?.baseUrl ?? process.env.GEMINI_BASE_URL;

  if (!apiKey) {
    return null;
  }

  return new GeminiClient({
    apiKey,
    model,
    baseUrl,
    fetch: config?.fetch,
  });
}
