import type { AnthropicConfig, GeminiConfig, AiProviderConfig, AiClient } from "../types";
import type { AiProviderType } from "../config/schema";
import { getAiConfig } from "../config/load";
import { ProviderAiClient } from "./openai";
import { AnthropicClient } from "./anthropic";
import { GeminiClient } from "./gemini";
import { FallbackAiClient } from "./fallback";

export { ProviderAiClient } from "./openai";
export { AnthropicClient } from "./anthropic";
export { GeminiClient } from "./gemini";

function createSingleClient(
  provider: AiProviderType,
  endpoint: { apiKey: string; baseUrl: string },
  model: string,
): AiClient {
  switch (provider) {
    case "anthropic":
      return new AnthropicClient({
        authToken: endpoint.apiKey,
        model,
        baseUrl: endpoint.baseUrl,
      });
    case "gemini":
      return new GeminiClient({
        apiKey: endpoint.apiKey,
        model,
        baseUrl: endpoint.baseUrl,
      });
    case "openai":
      return new ProviderAiClient({
        apiKey: endpoint.apiKey,
        model,
        baseUrl: endpoint.baseUrl,
      });
  }
}

/**
 * 同步工厂函数：创建 AI Client（支持多 endpoint fallback）
 */
export function createAiClient(provider?: AiProviderType): AiClient | null {
  const config = getAiConfig();
  const p = provider ?? config.provider;
  const providerConfig = config[p];

  if (!providerConfig || providerConfig.endpoints.length === 0) return null;

  // 单 endpoint：直接创建
  if (providerConfig.endpoints.length === 1) {
    return createSingleClient(p, providerConfig.endpoints[0], providerConfig.model);
  }

  // 多 endpoint：包装 FallbackAiClient
  return new FallbackAiClient(
    (endpoint) => createSingleClient(p, endpoint, providerConfig.model),
    providerConfig.endpoints,
    config.retry,
  );
}

/**
 * 获取 AI 配置（供高级场景使用）
 */
export { getAiConfig as loadSettings } from "../config/load";
