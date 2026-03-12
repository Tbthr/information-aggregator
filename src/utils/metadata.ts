import type { RawItemMetadata } from "../types/index";

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
  } catch {
    return null;
  }
}
