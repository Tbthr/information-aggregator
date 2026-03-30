/**
 * Topic 配置缓存模块
 * 从数据库加载 Topic 配置并缓存
 */

import { loadAllTopicsFromDb, type TopicWithSources } from "./load-pack-prisma";

let topicsCache: TopicWithSources[] | null = null;
let cacheTime = 0;
const DEFAULT_CACHE_TTL = 60_000; // 1 分钟

/**
 * 获取缓存的 topics 配置
 * @param ttlMs 缓存 TTL（毫秒），默认 60000
 */
export async function getTopics(
  ttlMs = DEFAULT_CACHE_TTL
): Promise<TopicWithSources[]> {
  const now = Date.now();

  // 缓存有效，直接返回
  if (topicsCache && (now - cacheTime) < ttlMs) {
    return topicsCache;
  }

  // 从数据库重新加载
  topicsCache = await loadAllTopicsFromDb();
  cacheTime = now;

  return topicsCache;
}

/**
 * 获取缓存的 topic（按 ID）
 */
export async function getTopicById(
  topicId: string
): Promise<TopicWithSources | undefined> {
  const topics = await getTopics();
  return topics.find((t) => t.id === topicId);
}

/**
 * 使缓存失效，下次调用会重新加载
 */
export function invalidateTopicsCache(): void {
  topicsCache = null;
  cacheTime = 0;
}

/**
 * 获取缓存状态
 */
export function getCacheStatus(): {
  cached: boolean;
  cachedAt: number | null;
  topicCount: number;
} {
  return {
    cached: topicsCache !== null,
    cachedAt: cacheTime || null,
    topicCount: topicsCache?.length ?? 0,
  };
}
