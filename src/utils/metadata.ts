/**
 * 元数据解析工具
 *
 * 注意：通用的类型守卫和字段获取函数已移至 types/validation.ts
 * 此文件仅保留元数据特有的解析逻辑
 */

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
    // 非空字符串解析失败时使用 warn 级别（改进静默错误处理）
    logger.warn("Failed to parse metadata JSON", {
      input: metadataJson.slice(0, 100),
      error: String(error),
    });
    return null;
  }
}
