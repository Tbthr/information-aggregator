import type { AiProviderConfig, AnthropicConfig, GeminiConfig, AiClient } from "../types";
import { ProviderAiClient } from "./openai";
import { AnthropicClient } from "./anthropic";
import { GeminiClient } from "./gemini";
import { DEFAULT_ANTHROPIC_MODEL } from "./base";

export { ProviderAiClient } from "./openai";
export { AnthropicClient } from "./anthropic";
export { GeminiClient } from "./gemini";
export { DEFAULT_GEMINI_MODEL, DEFAULT_ANTHROPIC_MODEL } from "./base";

export function createAiClient(config: AiProviderConfig): AiClient | null {
  if (!config.provider || !config.apiKey || !config.model) {
    return null;
  }

  return new ProviderAiClient({
    ...config,
    apiKey: config.apiKey,
    model: config.model,
  });
}

export function createAnthropicClient(config?: Partial<AnthropicConfig>): AiClient | null {
  const authToken = config?.authToken ?? process.env.ANTHROPIC_AUTH_TOKEN;
  const model = config?.model ?? process.env.ANTHROPIC_MODEL;
  const baseUrl = config?.baseUrl ?? process.env.ANTHROPIC_BASE_URL;

  if (!authToken || !model) {
    return null;
  }

  return new AnthropicClient({
    authToken,
    model,
    baseUrl,
    fetch: config?.fetch,
  });
}

export function createGeminiClient(config?: Partial<GeminiConfig>): AiClient | null {
  const apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY;
  const model = config?.model ?? process.env.GEMINI_MODEL;
  const baseUrl = config?.baseUrl ?? process.env.GEMINI_BASE_URL;

  if (!apiKey) {
    return null;
  }

  return new GeminiClient({
    apiKey,
    model,
    baseUrl,
    fetch: config?.fetch,
  });
}
