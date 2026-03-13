import type { AiProviderConfig, AnthropicConfig, GeminiConfig, AiClient } from "../types";
import type { AiSettings, AiProviderType } from "../config/schema";
import { loadAiSettings, buildAnthropicConfig, buildGeminiConfig, buildOpenAiConfig, getDefaultProvider } from "../config/load";
import { ProviderAiClient } from "./openai";
import { AnthropicClient } from "./anthropic";
import { GeminiClient } from "./gemini";

// 导出客户端类
export { ProviderAiClient } from "./openai";
export { AnthropicClient } from "./anthropic";
export { GeminiClient } from "./gemini";

// 缓存已加载的设置（单次运行中避免重复 IO）
let cachedSettings: AiSettings | null | undefined = undefined;

async function getSettings(): Promise<AiSettings | null> {
  if (cachedSettings !== undefined) return cachedSettings;
  cachedSettings = await loadAiSettings();
  return cachedSettings;
}

/**
 * 清除设置缓存（用于测试）
 */
export function clearSettingsCache(): void {
  cachedSettings = undefined;
}

/**
 * 统一的异步工厂函数
 * 优先级：显式传参 > 配置文件 > 环境变量 > 默认值
 */
export async function createAiClient(
  provider?: AiProviderType,
  explicitConfig?: Partial<AnthropicConfig> | Partial<GeminiConfig> | AiProviderConfig
): Promise<AiClient | null> {
  const settings = await getSettings();
  const p = provider ?? getDefaultProvider(settings);

  switch (p) {
    case "anthropic": {
      const config = buildAnthropicConfig(explicitConfig as Partial<AnthropicConfig>, settings);
      return config ? new AnthropicClient(config) : null;
    }
    case "gemini": {
      const config = buildGeminiConfig(explicitConfig as Partial<GeminiConfig>, settings);
      return config ? new GeminiClient(config) : null;
    }
    case "openai": {
      const config = buildOpenAiConfig(explicitConfig as AiProviderConfig, settings);
      return config ? new ProviderAiClient(config) : null;
    }
    default:
      return null;
  }
}

/**
 * 加载 AI 设置（供高级场景使用）
 */
export async function loadSettings(): Promise<AiSettings | null> {
  return getSettings();
}
