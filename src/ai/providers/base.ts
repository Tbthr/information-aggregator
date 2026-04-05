import type { AiClient, TopicSuggestion } from "../types";
import {
  getFetchImpl,
  parseScore,
  parseTopicSuggestions,
} from "../utils";
import { createLogger, truncateWithLength, maskSensitiveUrl, type Logger } from "../../utils/logger";
import { getAiConfig } from "../config/load";
import type { RetryConfig } from "../config/schema";

/**
 * 辅助函数：延迟执行
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    const slug = strategy.providerName.toLowerCase().replace(/[^a-z]/g, "");
    this.logger = createLogger(`ai:${slug}`);
  }

  /**
   * 获取重试配置
   */
  protected getRetryConfig(): RetryConfig {
    return getAiConfig().retry;
  }

  protected async request(prompt: string): Promise<unknown> {
    const url = this.strategy.buildUrl(this.config);
    const maskedUrl = maskSensitiveUrl(url);
    const body = this.strategy.buildBody(prompt, this.config);
    const bodyStr = JSON.stringify(body);

    const retryConfig = this.getRetryConfig();

    let lastError: Error | null = null;
    let delay = retryConfig.initialDelay;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const requestStartTime = Date.now();

        this.logger.info("Sending request", {
          url: maskedUrl,
          promptLength: prompt.length,
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries + 1,
        });

        this.logger.debug("Request details", {
          url: maskedUrl,
          prompt: truncateWithLength(prompt, 200),
          body: truncateWithLength(bodyStr, 500),
        });

        const response = await getFetchImpl(this.fetchImpl)(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...this.strategy.buildHeaders(this.config),
          },
          body: bodyStr,
        });

        const elapsed = Date.now() - requestStartTime;

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            delay = parseInt(retryAfter) * 1000;
          }

          this.logger.warn("Request rate limited, will retry", {
            url: maskedUrl,
            status: response.status,
            attempt: attempt + 1,
            delay,
            retryAfter,
          });

          throw new Error(`Rate limited (429)`);
        }

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
          attempt: attempt + 1,
        });

        const responseStr = JSON.stringify(json);
        this.logger.debug("Response details", {
          response: responseStr.length > 1000 ? responseStr.substring(0, 1000) + '...' : responseStr,
          fullLength: responseStr.length,
        });

        return json;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retryConfig.maxRetries) {
          this.logger.warn("Request failed, retrying", {
            attempt: attempt + 1,
            maxRetries: retryConfig.maxRetries + 1,
            delay,
            error: lastError.message,
          });

          await sleep(delay);
          delay = Math.min(delay * retryConfig.backoffFactor, retryConfig.maxDelay);
        }
      }
    }

    const totalElapsed = Date.now() - startTime;
    this.logger.error("All retries exhausted", {
      url: maskedUrl,
      totalElapsed,
      error: lastError?.message,
    });

    throw lastError;
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

  async generateText(prompt: string): Promise<string> {
    return this.narrateDigest(prompt);
  }

  async suggestTopics(prompt: string): Promise<TopicSuggestion[]> {
    const text = this.getText(await this.request(prompt));
    return parseTopicSuggestions(text);
  }

  async summarizeItem(title: string, content: string): Promise<string> {
    return this.getText(await this.request(`${title}\n\n${content}`));
  }
}
