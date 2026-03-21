/**
 * Policy Filter 缓存模块
 * 使用内存 Map 缓存 AI 过滤判断结果
 */

import type { FilterJudgment } from "../types/ai-response";

// 内存缓存
const judgmentCache = new Map<string, { judgment: FilterJudgment; fingerprint: string }>();

export function generateFingerprint(url: string, publishedAt: string | null): string {
  const datePart = publishedAt ? publishedAt.substring(0, 10) : "no-date";
  return `${url}|${datePart}`;
}

export async function getCachedJudgment(
  itemId: string,
  itemFingerprint: string,
): Promise<FilterJudgment | null> {
  const cached = judgmentCache.get(itemId);
  if (!cached) return null;

  if (cached.fingerprint && cached.fingerprint !== itemFingerprint) {
    return null;
  }

  return cached.judgment;
}

export async function saveJudgment(
  itemId: string,
  judgment: FilterJudgment,
  itemFingerprint: string,
): Promise<void> {
  judgmentCache.set(itemId, { judgment, fingerprint: itemFingerprint });
}

export async function batchGetCachedJudgments(
  items: Array<{ itemId: string; fingerprint: string }>,
): Promise<Map<string, FilterJudgment>> {
  const result = new Map<string, FilterJudgment>();

  for (const item of items) {
    const cached = judgmentCache.get(item.itemId);
    if (cached) {
      if (cached.fingerprint && cached.fingerprint !== item.fingerprint) continue;
      result.set(item.itemId, cached.judgment);
    }
  }

  return result;
}

export async function batchSaveJudgments(
  judgments: Map<string, { judgment: FilterJudgment; fingerprint: string }>,
): Promise<void> {
  for (const [itemId, data] of judgments) {
    judgmentCache.set(itemId, data);
  }
}
