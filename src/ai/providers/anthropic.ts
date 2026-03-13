import type { AnthropicConfig, AiClient } from "../types";
import { BaseAiClient, type RequestStrategy } from "./base";
import { getAnthropicResponseText } from "../utils";

/**
 * Anthropic 请求策略
 */
const anthropicStrategy: RequestStrategy<AnthropicConfig> = {
  providerName: "Anthropic",

  buildUrl(config) {
    const baseUrl = (config.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
    return `${baseUrl}/v1/messages`;
  },

  buildHeaders(config) {
    return {
      "x-api-key": config.authToken,
      "anthropic-version": "2023-06-01",
    };
  },

  buildBody(prompt, config) {
    return {
      model: config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    };
  },

  extractText: getAnthropicResponseText,
};

/**
 * Anthropic AI 客户端
 */
export class AnthropicClient extends BaseAiClient<AnthropicConfig> implements AiClient {
  constructor(config: AnthropicConfig) {
    super(config, anthropicStrategy, config.fetch);
  }
}
