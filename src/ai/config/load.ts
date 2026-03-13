import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import type { AnthropicConfig, GeminiConfig, AiProviderConfig } from "../types";
import type { AiSettings, AiProviderType } from "./schema";
import { AI_ENV_MAPPING } from "./schema";

/**
 * 解析可能包含环境变量引用的值
 * 支持格式：${ENV_VAR} 或 ${ENV_VAR:-default}
 */
export function resolveEnvRef(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const match = value.match(/^\$\{([^}]+)\}$/);
  if (!match) return value;

  const expr = match[1];
  const [envVar, defaultValue] = expr.split(":-");

  return process.env[envVar] ?? defaultValue;
}

/**
 * 从配置和环境变量合并配置值
 * 优先级：显式值 > 环境变量 > 默认值
 */
function mergeConfigValue<T extends string>(
  explicit: T | undefined,
  envVar: string | undefined,
  defaultValue?: string
): T | undefined {
  if (explicit) return explicit;
  if (envVar && process.env[envVar]) return process.env[envVar] as T;
  return defaultValue as T | undefined;
}

/**
 * 加载 settings.yaml 中的 AI 配置
 */
export async function loadAiSettings(settingsPath = "config/settings.yaml"): Promise<AiSettings | null> {
  try {
    const absolutePath = resolve(process.cwd(), settingsPath);
    const content = await readFile(absolutePath, "utf8");
    const parsed = YAML.parse(content) as { ai?: AiSettings } | null;
    return parsed?.ai ?? null;
  } catch {
    return null;
  }
}

/**
 * 构建 Anthropic 配置
 * 优先级：显式 config > settings.yaml > 环境变量
 * model 为必需字段，必须从配置中读取
 */
export function buildAnthropicConfig(
  explicitConfig: Partial<AnthropicConfig> | undefined,
  settings: AiSettings | null
): AnthropicConfig | null {
  const s = settings?.anthropic;

  // 优先级 1: 显式传参
  const explicitAuthToken = explicitConfig?.authToken ? resolveEnvRef(explicitConfig.authToken) : undefined;
  const explicitModel = explicitConfig?.model;
  const explicitBaseUrl = explicitConfig?.baseUrl;

  // 优先级 2: settings.yaml（解析环境变量引用）
  const settingsAuthToken = s?.authToken ? resolveEnvRef(s.authToken) : undefined;
  const settingsModel = s?.model;
  const settingsBaseUrl = s?.baseUrl;

  // 合并 authToken（必需字段）
  const authToken = mergeConfigValue(
    explicitAuthToken ?? settingsAuthToken,
    AI_ENV_MAPPING.anthropic.authToken
  );

  // 合并 model（必需字段，必须从配置中读取）
  const mergedModel = mergeConfigValue(
    explicitModel ?? settingsModel,
    AI_ENV_MAPPING.anthropic.model
  );

  if (!authToken || !mergedModel) return null;

  return {
    authToken,
    model: mergedModel,
    baseUrl: mergeConfigValue(
      explicitBaseUrl ?? settingsBaseUrl,
      AI_ENV_MAPPING.anthropic.baseUrl
    ),
    fetch: explicitConfig?.fetch,
  };
}

/**
 * 构建 Gemini 配置
 * 优先级：显式 config > settings.yaml > 环境变量
 * model 为必需字段，必须从配置中读取
 */
export function buildGeminiConfig(
  explicitConfig: Partial<GeminiConfig> | undefined,
  settings: AiSettings | null
): GeminiConfig | null {
  const s = settings?.gemini;

  // 优先级 1: 显式传参
  const explicitApiKey = explicitConfig?.apiKey ? resolveEnvRef(explicitConfig.apiKey) : undefined;
  const explicitModel = explicitConfig?.model;
  const explicitBaseUrl = explicitConfig?.baseUrl;

  // 优先级 2: settings.yaml
  const settingsApiKey = s?.apiKey ? resolveEnvRef(s.apiKey) : undefined;
  const settingsModel = s?.model;
  const settingsBaseUrl = s?.baseUrl;

  // 合并 apiKey（必需字段）
  const apiKey = mergeConfigValue(
    explicitApiKey ?? settingsApiKey,
    AI_ENV_MAPPING.gemini.apiKey
  );

  // 合并 model（必需字段，必须从配置中读取）
  const mergedModel = mergeConfigValue(
    explicitModel ?? settingsModel,
    AI_ENV_MAPPING.gemini.model
  );

  if (!apiKey || !mergedModel) return null;

  return {
    apiKey,
    model: mergedModel,
    baseUrl: mergeConfigValue(
      explicitBaseUrl ?? settingsBaseUrl,
      AI_ENV_MAPPING.gemini.baseUrl
    ),
    fetch: explicitConfig?.fetch,
  };
}

/**
 * 构建 OpenAI-compatible 配置
 * 优先级：显式 config > settings.yaml > 环境变量
 * model 为必需字段，必须从配置中读取
 */
export function buildOpenAiConfig(
  explicitConfig: AiProviderConfig | undefined,
  settings: AiSettings | null
): { apiKey: string; model: string; baseUrl?: string; fetch?: AiProviderConfig["fetch"] } | null {
  const s = settings?.openai;

  // 优先级 1: 显式传参
  const explicitApiKey = explicitConfig?.apiKey ? resolveEnvRef(explicitConfig.apiKey) : undefined;
  const explicitModel = explicitConfig?.model;
  const explicitBaseUrl = explicitConfig?.baseUrl;

  // 优先级 2: settings.yaml
  const settingsApiKey = s?.apiKey ? resolveEnvRef(s.apiKey) : undefined;
  const settingsModel = s?.model;
  const settingsBaseUrl = s?.baseUrl;

  // 合并 apiKey（必需字段）
  const apiKey = mergeConfigValue(
    explicitApiKey ?? settingsApiKey,
    AI_ENV_MAPPING.openai.apiKey
  );

  // 合并 model（必需字段，必须从配置中读取）
  const mergedModel = mergeConfigValue(
    explicitModel ?? settingsModel,
    AI_ENV_MAPPING.openai.model
  );

  if (!apiKey || !mergedModel) return null;

  return {
    apiKey,
    model: mergedModel,
    baseUrl: mergeConfigValue(
      explicitBaseUrl ?? settingsBaseUrl,
      AI_ENV_MAPPING.openai.baseUrl
    ),
    fetch: explicitConfig?.fetch,
  };
}

/**
 * 获取默认 provider
 */
export function getDefaultProvider(settings: AiSettings | null): AiProviderType {
  return settings?.defaultProvider ?? "anthropic";
}
