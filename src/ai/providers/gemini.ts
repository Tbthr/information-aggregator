import type { GeminiConfig, AiClient } from "../types";
import { BaseAiClient, type RequestStrategy } from "./base";
import { getGeminiResponseText } from "../utils";

/**
 * Gemini 内部配置（确保 model 必有值）
 */
interface GeminiInternalConfig extends GeminiConfig {
  model: string;
}

/**
 * Gemini 请求策略
 */
const geminiStrategy: RequestStrategy<GeminiInternalConfig> = {
  providerName: "Gemini",

  buildUrl(config) {
    const baseUrl = (config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta/models").replace(/\/+$/, "");
    return `${baseUrl}/${config.model}:generateContent?key=${config.apiKey}`;
  },

  buildHeaders() {
    return {};
  },

  buildBody(prompt) {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
      },
    };
  },

  extractText: getGeminiResponseText,
};

/**
 * Gemini AI 客户端
 */
export class GeminiClient extends BaseAiClient<GeminiInternalConfig> implements AiClient {
  constructor(config: GeminiConfig) {
    if (!config.model) {
      throw new Error("GeminiClient: model is required, configure it in Settings page");
    }
    const fullConfig: GeminiInternalConfig = {
      ...config,
      model: config.model,
    };
    super(fullConfig, geminiStrategy, config.fetch);
  }
}
