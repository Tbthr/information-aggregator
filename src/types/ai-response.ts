/**
 * AI 响应类型定义
 * 用于类型安全地处理各种 AI provider 的响应
 */

import { isRecord } from "./validation"

/**
 * OpenAI Responses API 响应格式
 */
export interface OpenAiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
}

/**
 * Anthropic Messages API 响应格式
 */
export interface AnthropicResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

/**
 * Gemini GenerateContent API 响应格式
 */
export interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

/**
 * Gemini 候选项
 */
export interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
}

/**
 * 类型守卫：检查是否为 OpenAI 响应格式
 */
export function isOpenAiResponse(value: unknown): value is OpenAiResponse {
  if (!isRecord(value)) return false;
  // 至少有 output_text 或 output 之一
  return typeof value.output_text === "string" || Array.isArray(value.output);
}

/**
 * 类型守卫：检查是否为 Anthropic 响应格式
 */
export function isAnthropicResponse(value: unknown): value is AnthropicResponse {
  if (!isRecord(value)) return false;
  return Array.isArray(value.content);
}

/**
 * 类型守卫：检查是否为 Gemini 响应格式
 */
export function isGeminiResponse(value: unknown): value is GeminiResponse {
  if (!isRecord(value)) return false;
  return Array.isArray(value.candidates);
}

/**
 * AI 过滤判断结果
 * 用于记录 AI 对条目是否保留的判断及其理由
 */
export interface FilterJudgment {
  /** 是否保留该条目 */
  keepDecision: boolean;
  /** 保留/丢弃的理由 */
  keepReason: string;
  /** 读者收益（可选）：说明该条目对读者的价值 */
  readerBenefit?: string;
  /** 阅读提示（可选）：帮助读者快速理解条目内容的提示 */
  readingHint?: string;
  /** 判断时间戳（ISO 8601 格式） */
  judgedAt: string;
}
