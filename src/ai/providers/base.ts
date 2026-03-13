import type { MultiDimensionalScore, HighlightsResult } from "../../types/index";
import type { AiClient, TopicSuggestion, ArticleEnrichResult, PostSummaryResult, DailyBriefOverviewResult } from "../types";
import {
  buildDeepQualityPrompt,
  buildKeyPointsPrompt,
  buildTaggingPrompt,
  buildSummaryPrompt,
  buildMultiDimensionalScorePrompt,
} from "../prompts-enrichment";
import { buildHighlightsPrompt } from "../prompts-highlights";
import {
  buildArticleEnrichPrompt,
  buildDailyBriefOverviewPrompt,
  parseArticleEnrichResult,
  parseDailyBriefOverviewResult,
} from "../prompts-daily-brief";
import { buildPostSummaryPrompt, parsePostSummaryResult } from "../prompts-x-analysis";
import {
  getFetchImpl,
  parseScore,
  parseTopicSuggestions,
  parseJsonObject,
  parseStringArray,
  parseNumber,
  parseMultiDimensionalScore,
  parseHighlightsResult,
} from "../utils";

/**
 * 请求策略接口 - 处理不同 Provider 的请求差异
 */
export interface RequestStrategy<TConfig> {
  /** Provider 名称（用于错误消息） */
  readonly providerName: string;
  /** 构建请求 URL */
  buildUrl(config: TConfig): string;
  /** 构建请求头 */
  buildHeaders(config: TConfig): Record<string, string>;
  /** 构建请求体 */
  buildBody(prompt: string, config: TConfig): unknown;
  /** 从响应中提取文本 */
  extractText(response: unknown): string;
}

/**
 * 抽象基类 - 实现所有公共方法
 */
export abstract class BaseAiClient<TConfig> implements AiClient {
  constructor(
    protected readonly config: TConfig,
    protected readonly strategy: RequestStrategy<TConfig>,
    protected readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  ) {}

  protected async request(prompt: string): Promise<unknown> {
    const url = this.strategy.buildUrl(this.config);
    const response = await getFetchImpl(this.fetchImpl)(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.strategy.buildHeaders(this.config),
      },
      body: JSON.stringify(this.strategy.buildBody(prompt, this.config)),
    });

    if (!response.ok) {
      throw new Error(`${this.strategy.providerName} request failed: ${response.status}`);
    }

    return response.json();
  }

  protected getText(response: unknown): string {
    return this.strategy.extractText(response);
  }

  // === AiClient 接口实现 ===

  async scoreCandidate(prompt: string): Promise<number> {
    return parseScore(await this.request(prompt), (r) => this.getText(r));
  }

  async summarizeCluster(prompt: string): Promise<string> {
    return this.getText(await this.request(prompt));
  }

  async narrateDigest(prompt: string): Promise<string> {
    return this.getText(await this.request(prompt));
  }

  async suggestTopics(prompt: string): Promise<TopicSuggestion[]> {
    const text = this.getText(await this.request(prompt));
    return parseTopicSuggestions(text);
  }

  async summarizeItem(title: string, snippet: string): Promise<string> {
    return this.getText(await this.request(`${title}\n\n${snippet}`));
  }

  // 深度 enrichment 方法

  async scoreWithContent(title: string, content: string, url?: string): Promise<number> {
    const prompt = buildDeepQualityPrompt(title, content, url);
    const response = this.getText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    const score = parsed ? parseNumber(parsed, "score") : null;
    return score ?? 0;
  }

  async extractKeyPoints(title: string, content: string, maxPoints = 5): Promise<string[]> {
    const prompt = buildKeyPointsPrompt(title, content, maxPoints);
    const response = this.getText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "keyPoints") : [];
  }

  async generateTags(title: string, content: string, maxTags = 5): Promise<string[]> {
    const prompt = buildTaggingPrompt(title, content, maxTags);
    const response = this.getText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseStringArray(parsed, "tags") : [];
  }

  async summarizeContent(title: string, content: string, maxLength = 150): Promise<string> {
    const prompt = buildSummaryPrompt(title, content, maxLength);
    return this.getText(await this.request(prompt));
  }

  // 多维评分方法

  async scoreMultiDimensional(title: string, content: string, url?: string): Promise<MultiDimensionalScore | null> {
    const prompt = buildMultiDimensionalScorePrompt(title, content, url);
    const response = this.getText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseMultiDimensionalScore(parsed) : null;
  }

  // 趋势洞察方法

  async generateHighlights(titles: string[]): Promise<HighlightsResult | null> {
    const prompt = buildHighlightsPrompt(titles);
    const response = this.getText(await this.request(prompt));
    const parsed = parseJsonObject(response);
    return parsed ? parseHighlightsResult(parsed) : null;
  }

  // Daily Brief 方法

  async enrichArticle(title: string, content: string): Promise<ArticleEnrichResult | null> {
    const prompt = buildArticleEnrichPrompt(title, content);
    const response = this.getText(await this.request(prompt));
    return parseArticleEnrichResult(response);
  }

  async generateDailyBriefOverview(descriptions: string[]): Promise<DailyBriefOverviewResult | null> {
    const prompt = buildDailyBriefOverviewPrompt(descriptions);
    const response = this.getText(await this.request(prompt));
    return parseDailyBriefOverviewResult(response);
  }

  // X Analysis 方法

  async summarizePost(title: string, content: string): Promise<PostSummaryResult | null> {
    const prompt = buildPostSummaryPrompt(title, content);
    const response = this.getText(await this.request(prompt));
    return parsePostSummaryResult(response);
  }
}
