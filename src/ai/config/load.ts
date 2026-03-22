/**
 * AI 配置加载（从环境变量）
 */

import type { AiConfig, AiProviderType, ProviderConfig, ProviderEndpoint, RetryConfig } from "./schema";

// --- 默认值 ---

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
};

const DEFAULT_BASE_URLS: Record<AiProviderType, string> = {
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
  openai: "https://api.openai.com/v1",
};

// --- 辅助函数 ---

/** 解析逗号分隔的环境变量为非空字符串数组 */
function parseCsv(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value.split(",").map(s => s.trim()).filter(Boolean);
}

/** 解析整数环境变量，带默认值 */
function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/** 解析浮点环境变量，带默认值 */
function parseFloatEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 将 keys 和 baseUrls 按索引配对为 ProviderEndpoint 数组。
 * baseUrls 不足时使用 defaultBaseUrl，多余时忽略并警告。
 */
function pairEndpoints(
  keys: string[],
  baseUrls: string[],
  defaultBaseUrl: string,
  providerName: string,
): ProviderEndpoint[] {
  if (keys.length === 0) return [];

  const endpoints: ProviderEndpoint[] = [];
  for (let i = 0; i < keys.length; i++) {
    endpoints.push({ apiKey: keys[i], baseUrl: baseUrls[i] || defaultBaseUrl });
  }

  if (baseUrls.length > keys.length) {
    console.warn(
      `[ai:config] ${providerName}: BASE_URLs (${baseUrls.length}) 多于 API_KEYs (${keys.length})，多余的 URL 被忽略`,
    );
  }

  return endpoints;
}

/** 构建单个 provider 的配置 */
function buildProviderConfig(
  keysEnv: string | undefined,
  modelEnv: string | undefined,
  baseUrlsEnv: string | undefined,
  providerName: AiProviderType,
): ProviderConfig | null {
  const keys = parseCsv(keysEnv);
  const model = modelEnv?.trim();

  if (keys.length === 0 || !model) return null;

  const baseUrls = parseCsv(baseUrlsEnv);
  const endpoints = pairEndpoints(keys, baseUrls, DEFAULT_BASE_URLS[providerName], providerName);

  if (endpoints.length === 0) return null;

  return { model, endpoints };
}

// --- 主加载函数 ---

/** 从环境变量加载完整 AI 配置（同步，无 DB 依赖） */
export function loadAiConfigFromEnv(): AiConfig {
  const provider = parseProviderType(process.env.AI_DEFAULT_PROVIDER);

  return {
    provider,
    anthropic: buildProviderConfig(
      process.env.ANTHROPIC_API_KEYS,
      process.env.ANTHROPIC_MODEL,
      process.env.ANTHROPIC_BASE_URLS,
      "anthropic",
    ),
    gemini: buildProviderConfig(
      process.env.GEMINI_API_KEYS,
      process.env.GEMINI_MODEL,
      process.env.GEMINI_BASE_URLS,
      "gemini",
    ),
    openai: buildProviderConfig(
      process.env.OPENAI_API_KEYS,
      process.env.OPENAI_MODEL,
      process.env.OPENAI_BASE_URLS,
      "openai",
    ),
    retry: {
      maxRetries: parseIntEnv(process.env.AI_MAX_RETRIES, DEFAULT_RETRY.maxRetries),
      initialDelay: parseIntEnv(process.env.AI_INITIAL_DELAY_MS, DEFAULT_RETRY.initialDelay),
      maxDelay: parseIntEnv(process.env.AI_MAX_DELAY_MS, DEFAULT_RETRY.maxDelay),
      backoffFactor: parseFloatEnv(process.env.AI_BACKOFF_FACTOR, DEFAULT_RETRY.backoffFactor),
    },
    batchSize: parseIntEnv(process.env.AI_BATCH_SIZE, 5),
    concurrency: parseIntEnv(process.env.AI_CONCURRENCY, 2),
  };
}

/** 解析并校验 AI_DEFAULT_PROVIDER */
function parseProviderType(value: string | undefined): AiProviderType {
  if (value === "gemini" || value === "openai") return value;
  return "anthropic";
}

// --- 缓存 ---

let cachedConfig: AiConfig | undefined;

/** 获取 AI 配置（带模块级缓存） */
export function getAiConfig(): AiConfig {
  if (!cachedConfig) {
    cachedConfig = loadAiConfigFromEnv();
  }
  return cachedConfig;
}

/** 清除配置缓存（用于测试） */
export function clearAiConfigCache(): void {
  cachedConfig = undefined;
}
