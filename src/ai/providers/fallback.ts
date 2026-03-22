/**
 * FallbackAiClient: endpoint 轮转包装器
 * 当当前 endpoint 所有重试耗尽后，自动切换到下一个 endpoint
 */

import type { AiClient } from "../types";
import type { ProviderEndpoint, RetryConfig } from "../config/schema";

export class FallbackAiClient implements AiClient {
  constructor(
    private readonly createClientForEndpoint: (endpoint: ProviderEndpoint, index: number) => AiClient,
    private readonly endpoints: ProviderEndpoint[],
    private readonly retryConfig: RetryConfig,
  ) {}

  private async withFallback<T>(method: (client: AiClient) => Promise<T>): Promise<T> {
    const errors: Error[] = [];

    for (let epIndex = 0; epIndex < this.endpoints.length; epIndex++) {
      const client = this.createClientForEndpoint(this.endpoints[epIndex], epIndex);
      try {
        return await method(client);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);

        if (epIndex < this.endpoints.length - 1) {
          console.warn(
            `[ai:fallback] Endpoint ${epIndex + 1}/${this.endpoints.length} 失败: ${err.message}，尝试下一个`,
          );
        }
      }
    }

    const lastError = errors[errors.length - 1];
    throw new Error(
      `所有 ${this.endpoints.length} 个 endpoint 均失败。最后错误: ${lastError.message}`,
    );
  }

  async scoreCandidate(prompt: string) {
    return this.withFallback(c => c.scoreCandidate(prompt));
  }

  async summarizeCluster(prompt: string) {
    return this.withFallback(c => c.summarizeCluster(prompt));
  }

  async narrateDigest(prompt: string) {
    return this.withFallback(c => c.narrateDigest(prompt));
  }

  async suggestTopics(prompt: string) {
    return this.withFallback(c => c.suggestTopics(prompt));
  }

  async summarizeItem(title: string, content: string) {
    return this.withFallback(c => c.summarizeItem(title, content));
  }

  async scoreWithContent(title: string, content: string, url?: string) {
    return this.withFallback(c => c.scoreWithContent(title, content, url));
  }

  async extractKeyPoints(title: string, content: string, maxPoints?: number) {
    return this.withFallback(c => c.extractKeyPoints(title, content, maxPoints));
  }

  async generateTags(title: string, content: string, maxTags?: number) {
    return this.withFallback(c => c.generateTags(title, content, maxTags));
  }

  async summarizeContent(title: string, content: string, maxLength?: number) {
    return this.withFallback(c => c.summarizeContent(title, content, maxLength));
  }

  async scoreMultiDimensional(title: string, content: string, url?: string) {
    return this.withFallback(c => c.scoreMultiDimensional(title, content, url));
  }

  async generateHighlights(titles: string[]) {
    return this.withFallback(c => c.generateHighlights(titles));
  }

  async enrichArticle(title: string, content: string) {
    return this.withFallback(c => c.enrichArticle(title, content));
  }

  async generateDailyBriefOverview(descriptions: string[]) {
    return this.withFallback(c => c.generateDailyBriefOverview(descriptions));
  }

  async summarizePost(title: string, content: string) {
    return this.withFallback(c => c.summarizePost(title, content));
  }

  async batchFilter(items: Parameters<AiClient["batchFilter"]>[0], packContext: Parameters<AiClient["batchFilter"]>[1]) {
    return this.withFallback(c => c.batchFilter(items, packContext));
  }
}
