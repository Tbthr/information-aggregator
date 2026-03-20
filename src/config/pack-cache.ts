/**
 * Pack 配置缓存模块
 * 从数据库加载 Pack 配置并缓存
 */

import type { SourcePack } from "../types/index";
import { loadAllPacksFromDb } from "./load-pack-prisma";

let packsCache: SourcePack[] | null = null;
let cacheTime = 0;
const DEFAULT_CACHE_TTL = 60_000; // 1 分钟

/**
 * 获取缓存的 packs 配置
 * @param ttlMs 缓存 TTL（毫秒），默认 60000
 */
export async function getPacks(
  ttlMs = DEFAULT_CACHE_TTL
): Promise<SourcePack[]> {
  const now = Date.now();

  // 缓存有效，直接返回
  if (packsCache && (now - cacheTime) < ttlMs) {
    return packsCache;
  }

  // 从数据库重新加载
  packsCache = await loadAllPacksFromDb();
  cacheTime = now;

  return packsCache;
}

/**
 * 获取缓存的 pack（按 ID）
 */
export async function getPackById(
  packId: string
): Promise<SourcePack | undefined> {
  const packs = await getPacks();
  return packs.find((p) => p.id === packId);
}

/**
 * 使缓存失效，下次调用会重新加载
 */
export function invalidatePacksCache(): void {
  packsCache = null;
  cacheTime = 0;
}

/**
 * 获取缓存状态
 */
export function getCacheStatus(): {
  cached: boolean;
  cachedAt: number | null;
  packCount: number;
} {
  return {
    cached: packsCache !== null,
    cachedAt: cacheTime || null,
    packCount: packsCache?.length ?? 0,
  };
}
