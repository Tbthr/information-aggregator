/**
 * 统一缓存模块
 * 纯内存缓存实现
 */

import type { ExtractedContent } from "../types/index";
import { ContentCache } from "./content-cache";

export interface UnifiedCacheOptions {
  /** 内存缓存 TTL（秒），默认 86400（24小时） */
  memoryTtl?: number;
  /** 内存缓存最大条目数，默认 1000 */
  maxMemorySize?: number;
}

export interface CacheStats {
  memorySize: number;
  dbSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * 内存缓存管理器
 */
export class UnifiedContentCache {
  private memoryCache: ContentCache<ExtractedContent>;

  // 统计
  private hits = 0;
  private misses = 0;

  constructor(_db: unknown, options: UnifiedCacheOptions = {}) {
    this.memoryCache = new ContentCache<ExtractedContent>({
      ttl: options.memoryTtl ?? 86400,
      maxSize: options.maxMemorySize ?? 1000,
    });
  }

  get(url: string): ExtractedContent | null {
    const hit = this.memoryCache.get(url);
    if (hit) {
      this.hits++;
      return hit;
    }

    this.misses++;
    return null;
  }

  set(url: string, content: ExtractedContent): void {
    this.memoryCache.set(url, content, 86400);
  }

  has(url: string): boolean {
    return this.get(url) !== null;
  }

  delete(url: string): boolean {
    return this.memoryCache.delete(url);
  }

  clearMemory(): void {
    this.memoryCache.clear();
  }

  cleanupExpired(): number {
    return 0;
  }

  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const total = this.hits + this.misses;

    return {
      memorySize: memoryStats.size,
      dbSize: 0,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

export function createUnifiedCache(
  db: unknown,
  options?: UnifiedCacheOptions
): UnifiedContentCache {
  return new UnifiedContentCache(db, options);
}
