import type { MultiDimensionalScore, HighlightsResult } from "../types/index";
import type { GeminiResponse, TopicSuggestion } from "./types";

export function getFetchImpl(fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return fetchFn ?? fetch;
}

export function getBaseUrl(baseUrl?: string): string {
  return (baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

export function getOpenAiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid AI response payload");
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim() !== "") {
    return record.output_text.trim();
  }

  const output = record.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim() !== "") {
          return text.trim();
        }
      }
    }
  }

  throw new Error("AI response did not contain output text");
}

export function getAnthropicResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Anthropic response payload");
  }

  const record = payload as Record<string, unknown>;
  const content = record.content;

  if (!Array.isArray(content)) {
    throw new Error("Anthropic response did not contain content array");
  }

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const blockRecord = block as Record<string, unknown>;
    if (blockRecord.type === "text" && typeof blockRecord.text === "string") {
      const text = blockRecord.text.trim();
      if (text !== "") {
        return text;
      }
    }
  }

  throw new Error("Anthropic response did not contain text content");
}

export function getGeminiResponseText(payload: unknown): string {
  const response = payload as GeminiResponse;

  if (!response || !Array.isArray(response.candidates) || response.candidates.length === 0) {
    throw new Error("Gemini response did not contain candidates");
  }

  const firstCandidate = response.candidates[0];
  if (!firstCandidate?.content?.parts?.length) {
    throw new Error("Gemini response structure is invalid");
  }

  const firstPart = firstCandidate.content.parts[0];
  const text = firstPart?.text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Gemini response did not contain text");
  }

  return text.trim();
}

export function parseScore(payload: unknown, responseParser: (p: unknown) => string): number {
  const text = responseParser(payload);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    throw new Error(`AI score response did not contain a number: ${text}`);
  }

  return Number(match[0]);
}

export function parseTopicSuggestions(text: string): TopicSuggestion[] {
  // 尝试从文本中提取 JSON
  const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { suggestions?: Array<{ title?: string; description?: string; sourceIndices?: number[] }> };
    if (!Array.isArray(parsed.suggestions)) {
      return [];
    }

    return parsed.suggestions
      .filter((s): s is { title: string; description: string; sourceIndices?: number[] } =>
        typeof s.title === "string" && typeof s.description === "string")
      .map((s) => ({
        title: s.title,
        description: s.description,
        sourceLinks: Array.isArray(s.sourceIndices) ? s.sourceIndices.map(String) : [],
      }));
  } catch {
    return [];
  }
}

/**
 * 从 AI 响应中解析 JSON 对象
 */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  // 尝试提取 JSON 对象（处理可能的 markdown 代码块）
  let cleaned = text.trim();

  // 移除 markdown 代码块标记
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/, "");

  // 尝试找到最外层的 JSON 对象
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 从 JSON 对象中提取字符串数组
 */
export function parseStringArray(obj: Record<string, unknown>, key: string): string[] {
  const value = obj[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * 从 JSON 对象中提取数字
 */
export function parseNumber(obj: Record<string, unknown>, key: string): number | null {
  const value = obj[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * 从 JSON 对象中提取字符串
 */
export function parseString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (typeof value === "string") {
    return value;
  }
  return null;
}

/**
 * 解析 Highlights 结果
 */
export function parseHighlightsResult(obj: Record<string, unknown>): HighlightsResult | null {
  const summary = parseString(obj, "summary");
  const trends = obj.trends;

  if (typeof summary !== "string" || !Array.isArray(trends)) {
    return null;
  }

  return {
    summary,
    trends: trends.filter((t): t is string => typeof t === "string"),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 解析多维评分结果
 */
export function parseMultiDimensionalScore(obj: Record<string, unknown>): MultiDimensionalScore | null {
  const relevance = parseNumber(obj, "relevance");
  const quality = parseNumber(obj, "quality");
  const timeliness = parseNumber(obj, "timeliness");
  const total = parseNumber(obj, "total");
  const reason = parseString(obj, "reason");

  if (relevance === null || quality === null || timeliness === null || total === null) {
    return null;
  }

  return {
    relevance,
    quality,
    timeliness,
    total,
    reason: reason ?? "",
  };
}
