/**
 * AI 配置 Schema（基于环境变量）
 */

/** 支持的 AI Provider 类型 */
export type AiProviderType = "anthropic" | "gemini" | "openai";

/** 单个 endpoint：一个 API Key 配对一个 Base URL */
export interface ProviderEndpoint {
  apiKey: string;
  baseUrl: string;
}

/** 单个 provider 的配置 */
export interface ProviderConfig {
  /** 模型名称（该 provider 下所有 endpoint 共用同一模型） */
  model: string;
  /** 有序的 endpoint 列表，index 0 为主 endpoint，后续为 fallback */
  endpoints: ProviderEndpoint[];
}

/** 重试配置 */
export interface RetryConfig {
  /** 单个 endpoint 最大重试次数（不含首次请求） */
  maxRetries: number;
  /** 首次重试等待时间（毫秒） */
  initialDelay: number;
  /** 重试等待时间上限（毫秒） */
  maxDelay: number;
  /** 退避因子，每次重试等待时间乘以此值 */
  backoffFactor: number;
}

/** 完整的 AI 配置（从环境变量加载） */
export interface AiConfig {
  /** 默认 provider */
  provider: AiProviderType;
  /** 各 provider 的配置（未配置则为 null） */
  anthropic: ProviderConfig | null;
  gemini: ProviderConfig | null;
  openai: ProviderConfig | null;
  /** 重试配置 */
  retry: RetryConfig;
  /** 批处理：每批项目数量 */
  batchSize: number;
  /** 批处理：批内最大并发数 */
  concurrency: number;
}
