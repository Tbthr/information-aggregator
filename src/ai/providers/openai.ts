import type { AiProviderConfig, AiClient } from "../types";
import type { MultiDimensionalScore, HighlightsResult } from "../../types/index";
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
import {
  buildPostSummaryPrompt,
  parsePostSummaryResult,
} from "../prompts-x-analysis";
import {
  getFetchImpl,
  getBaseUrl,
  getOpenAiResponseText,
  parseScore,
  parseTopicSuggestions,
  parseJsonObject,
  parseStringArray,
  parseNumber,
  parseMultiDimensionalScore,
  parseHighlightsResult,
} from "../utils";
import type { TopicSuggestion, ArticleEnrichResult, PostSummaryResult, DailyBriefOverviewResult } from "../types";

export class ProviderAiClient implements AiClient {
  constructor(private readonly config: Required<Pick<AiProviderConfig, "apiKey" | "model">> & AiProviderConfig) {}

  private async request(prompt: string): Promise<unknown> {
    const response = await getFetchImpl(this.config.fetch)(`${getBaseUrl(this.config.baseUrl)}/responses`, {
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
