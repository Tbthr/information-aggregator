import type { RawItemMetadata } from "../types/index";
import { createLogger } from "./logger";

const logger = createLogger("utils:metadata");

/**
 * 解析 RawItem 的 metadata JSON 字符串
 */
export function parseRawItemMetadata(metadataJson: string | undefined): RawItemMetadata | null {
  if (typeof metadataJson !== "string" || metadataJson.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson) as RawItemMetadata | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    logger.debug("Failed to parse metadata JSON", { error: String(error) });
    return null;
  }
}

/**
 * 类型守卫：检查值是否为对象
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 安全获取字符串字段
 */
export function getStringField(obj: Record<string, unknown>, field: string): string | undefined {
  const value = obj[field];
  return typeof value === "string" ? value : undefined;
}

/**
 * 安全获取数字字段
 */
export function getNumberField(obj: Record<string, unknown>, field: string): number | undefined {
  const value = obj[field];
  return typeof value === "number" ? value : undefined;
}

/**
 * 安全获取对象字段
 */
export function getObjectField(obj: Record<string, unknown>, field: string): Record<string, unknown> | undefined {
  const value = obj[field];
  return isRecord(value) ? value : undefined;
}

/**
 * 安全获取数组字段
 */
export function getArrayField(obj: Record<string, unknown>, field: string): unknown[] | undefined {
  const value = obj[field];
  return Array.isArray(value) ? value : undefined;
}
