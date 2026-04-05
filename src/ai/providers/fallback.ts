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

  async generateText(prompt: string) {
    return this.withFallback(c => c.generateText(prompt));
  }

  async suggestTopics(prompt: string) {
    return this.withFallback(c => c.suggestTopics(prompt));
  }

  async summarizeItem(title: string, content: string) {
    return this.withFallback(c => c.summarizeItem(title, content));
  }

  async complete(options: { system?: string; prompt: string; maxTokens?: number }) {
    return this.withFallback(c => c.complete(options));
  }
}
