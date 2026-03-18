/**
 * AI 全局配置 Schema
 */

/** 支持的 AI Provider 类型 */
export type AiProviderType = "anthropic" | "gemini" | "openai";

/** Anthropic 配置 */
export interface AnthropicSettings {
  /** API Token（支持 ${VAR} 引用环境变量） */
  authToken?: string;
  model?: string;
  baseUrl?: string;
}

/** Gemini 配置 */
export interface GeminiSettings {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/** OpenAI-compatible 配置 */
export interface OpenAiSettings {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/**
 * AI 全局配置（可放在 config/settings.yaml 中）
 */
export interface AiSettings {
  /** 默认 provider */
  defaultProvider?: AiProviderType;

  /** 并发控制：批次大小（默认 5） */
  defaultBatchSize?: number;

  /** 并发控制：最大并发数（默认 2） */
  defaultConcurrency?: number;

  /** Anthropic 配置 */
  anthropic?: AnthropicSettings;

  /** Gemini 配置 */
  gemini?: GeminiSettings;

  /** OpenAI-compatible 配置 */
  openai?: OpenAiSettings;
}

/**
 * 环境变量映射
 */
export const AI_ENV_MAPPING = {
  anthropic: {
    authToken: "ANTHROPIC_AUTH_TOKEN",
    model: "ANTHROPIC_MODEL",
    baseUrl: "ANTHROPIC_BASE_URL",
  },
  gemini: {
    apiKey: "GEMINI_API_KEY",
    model: "GEMINI_MODEL",
    baseUrl: "GEMINI_BASE_URL",
  },
  openai: {
    apiKey: "OPENAI_API_KEY",
    model: "OPENAI_MODEL",
    baseUrl: "OPENAI_BASE_URL",
  },
} as const;
