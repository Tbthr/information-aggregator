import type { MultiDimensionalScore, HighlightsResult } from "../../types/index";
import type { AiClient, TopicSuggestion, ArticleEnrichResult, PostSummaryResult, DailyBriefOverviewResult } from "../types";
import type { FilterJudgment } from "../../types/ai-response";
import type { FilterItem, PackContext } from "../prompts-filter";
import {
  buildDeepQualityPrompt,
  buildKeyPointsPrompt,
  buildTaggingPrompt,
  buildSummaryPrompt,
  buildMultiDimensionalScorePrompt,
} from "../prompts-enrichment";
import { buildHighlightsPrompt } from "../prompts-highlights";
import { buildFilterPrompt } from "../prompts-filter";
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
import { createLogger, truncateWithLength, maskSensitiveUrl, type Logger } from "../../utils/logger";
import { isRecord, isArray } from "../../types/validation";

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
  protected readonly logger: Logger;

  constructor(
    protected readonly config: TConfig,
    protected readonly strategy: RequestStrategy<TConfig>,
    protected readonly fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  ) {
    // 在构造函数中初始化 logger，此时 strategy 已经可用
    const slug = strategy.providerName.toLowerCase().replace(/[^a-z]/g, "");
    this.logger = createLogger(`ai:${slug}`);
  }

  protected async request(prompt: string): Promise<unknown> {
    const url = this.strategy.buildUrl(this.config);
    const maskedUrl = maskSensitiveUrl(url);
    const body = this.strategy.buildBody(prompt, this.config);
    const bodyStr = JSON.stringify(body);
    const startTime = Date.now();

    this.logger.info("Sending request", {
      url: maskedUrl,
      promptLength: prompt.length,
    });

    this.logger.debug("Request details", {
      url: maskedUrl,
      prompt: truncateWithLength(prompt, 200),
      body: truncateWithLength(bodyStr, 500),
    });

    try {
      const response = await getFetchImpl(this.fetchImpl)(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...this.strategy.buildHeaders(this.config),
        },
        body: bodyStr,
      });

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        this.logger.error("Request failed", {
          url: maskedUrl,
          status: response.status,
          elapsed,
        });
        throw new Error(`${this.strategy.providerName} request failed: ${response.status}`);
      }

      const json = await response.json();
      const text = this.strategy.extractText(json);

      this.logger.info("Request completed", {
        status: response.status,
        responseLength: text.length,
        elapsed,
      });

      this.logger.debug("Response details", {
        response: truncateWithLength(JSON.stringify(json), 1000),
      });

      return json;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      this.logger.error("Request error", {
        url: maskedUrl,
        error: error instanceof Error ? error.message : String(error),
        elapsed,
      });
      throw error;
    }
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

  // 批量过滤判断方法

  async batchFilter(items: FilterItem[], packContext: PackContext): Promise<FilterJudgment[]> {
    if (items.length === 0) {
      return [];
    }

    const prompt = buildFilterPrompt(items, packContext);
    const response = this.getText(await this.request(prompt));
    const parsed = parseJsonObject(response);

    if (!parsed || !isArray(parsed.judgments)) {
      this.logger.warn("Invalid batchFilter response", { response: response.slice(0, 200) });
      return [];
    }

    const judgedAt = new Date().toISOString();
    const judgments: FilterJudgment[] = [];

    for (const j of parsed.judgments as unknown[]) {
      if (!isRecord(j)) continue;

      const keep = j.keep;
      const reason = j.reason;
      if (typeof keep !== "boolean" || typeof reason !== "string") continue;

      judgments.push({
        keepDecision: keep,
        keepReason: reason,
        readerBenefit: typeof j.benefit === "string" ? j.benefit : undefined,
        readingHint: typeof j.hint === "string" ? j.hint : undefined,
        judgedAt,
      });
    }

    return judgments;
  }
}
