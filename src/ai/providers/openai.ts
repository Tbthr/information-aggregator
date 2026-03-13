import type { AiProviderConfig, AiClient } from "../types";
import { BaseAiClient, type RequestStrategy } from "./base";
import { getOpenAiResponseText, getBaseUrl } from "../utils";

/**
 * OpenAI 内部配置（确保 apiKey 和 model 必有值）
 */
interface OpenAiInternalConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetch?: AiProviderConfig["fetch"];
}

/**
 * OpenAI 请求策略
 */
const openAiStrategy: RequestStrategy<OpenAiInternalConfig> = {
  providerName: "AI provider",

  buildUrl(config) {
    return `${getBaseUrl(config.baseUrl)}/responses`;
  },

  buildHeaders(config) {
    return {
      authorization: `Bearer ${config.apiKey}`,
    };
  },

  buildBody(prompt, config) {
    return {
      model: config.model,
      input: prompt,
    };
  },

  extractText: getOpenAiResponseText,
};

/**
 * OpenAI-compatible AI 客户端
 */
export class ProviderAiClient extends BaseAiClient<OpenAiInternalConfig> implements AiClient {
  constructor(config: OpenAiInternalConfig) {
    super(config, openAiStrategy, config.fetch);
  }
}
