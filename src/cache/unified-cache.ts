/**
 * 统一缓存模块
 * 提供二级缓存：L1 内存缓存 + L2 数据库缓存
 */

import type { Database } from "bun:sqlite";
import type { ExtractedContent } from "../types/index";
import { ContentCache } from "./content-cache";

export interface UnifiedCacheOptions {
  /** 内存缓存 TTL（秒），默认 86400（24小时） */
  memoryTtl?: number;
  /** 数据库缓存 TTL（秒），默认 86400（24小时） */
  dbTtl?: number;
  /** 内存缓存最大条目数，默认 1000 */
  maxMemorySize?: number;
  /** 是否启用数据库缓存，默认 true */
  enableDbCache?: boolean;
}

export interface CacheStats {
  memorySize: number;
  dbSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * 二级缓存管理器
 * - L1: 内存缓存（快速访问，进程内）
 * - L2: 数据库缓存（持久化，跨进程）
 */
export class UnifiedContentCache {
  private memoryCache: ContentCache<ExtractedContent>;
  private db: Database | null;
  private options: Required<UnifiedCacheOptions>;

  // 统计
  private hits = 0;
  private misses = 0;

  constructor(db: Database | null, options: UnifiedCacheOptions = {}) {
    this.db = db;
    this.options = {
      memoryTtl: options.memoryTtl ?? 86400,
      dbTtl: options.dbTtl ?? 86400,
      maxMemorySize: options.maxMemorySize ?? 1000,
      enableDbCache: options.enableDbCache ?? true,
    };

    this.memoryCache = new ContentCache<ExtractedContent>({
      ttl: this.options.memoryTtl,
      maxSize: this.options.maxMemorySize,
    });
  }

  /**
   * 获取缓存（先 L1 内存，再 L2 数据库）
   */
  get(url: string): ExtractedContent | null {
    // L1: 内存缓存
    const memoryHit = this.memoryCache.get(url);
    if (memoryHit) {
      this.hits++;
      return memoryHit;
    }

    // L2: 数据库缓存
    if (this.db && this.options.enableDbCache) {
      const dbHit = this.getFromDb(url);
      if (dbHit) {
        this.hits++;
        // 回填内存缓存
        this.memoryCache.set(url, dbHit, this.options.memoryTtl);
        return dbHit;
      }
    }

    this.misses++;
    return null;
  }

  /**
   * 设置缓存（同时写入 L1 和 L2）
   */
  set(url: string, content: ExtractedContent): void {
    // L1: 内存缓存
    this.memoryCache.set(url, content, this.options.memoryTtl);

    // L2: 数据库缓存
    if (this.db && this.options.enableDbCache) {
      this.setToDb(url, content);
    }
  }

  /**
   * 检查缓存是否存在
   */
  has(url: string): boolean {
    return this.get(url) !== null;
  }

  /**
   * 删除缓存
   */
  delete(url: string): boolean {
    const memoryDeleted = this.memoryCache.delete(url);

    if (this.db && this.options.enableDbCache) {
      try {
        this.db.prepare("DELETE FROM extracted_content_cache WHERE url = ?").run(url);
      } catch {
        // 忽略删除错误
      }
    }

    return memoryDeleted;
  }

  /**
   * 清空内存缓存
   */
  clearMemory(): void {
    this.memoryCache.clear();
  }

  /**
   * 清理过期的数据库缓存
   */
  cleanupExpired(): number {
    if (!this.db || !this.options.enableDbCache) {
      return 0;
    }

    try {
      const now = new Date().toISOString();
      const result = this.db
        .prepare("DELETE FROM extracted_content_cache WHERE expires_at <= ?")
        .run(now);
      return result.changes;
    } catch {
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const total = this.hits + this.misses;

    return {
      memorySize: memoryStats.size,
      dbSize: this.getDbSize(),
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  // ===== 私有方法 =====

  private getFromDb(url: string): ExtractedContent | null {
    if (!this.db) return null;

    try {
      const now = new Date().toISOString();
      const row = this.db
        .prepare("SELECT content_json FROM extracted_content_cache WHERE url = ? AND expires_at > ?")
        .get(url, now) as { content_json: string } | undefined;

      if (!row) return null;

      return JSON.parse(row.content_json) as ExtractedContent;
    } catch {
      return null;
    }
  }

  private setToDb(url: string, content: ExtractedContent): void {
    if (!this.db) return;

    try {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + this.options.dbTtl * 1000).toISOString();

      this.db
        .prepare(`
          INSERT OR REPLACE INTO extracted_content_cache (url, content_json, cached_at, expires_at)
          VALUES (?, ?, ?, ?)
        `)
        .run(url, JSON.stringify(content), now, expiresAt);
    } catch {
      // 忽略写入错误
    }
  }

  private getDbSize(): number {
    if (!this.db) return 0;

    try {
      const now = new Date().toISOString();
      const row = this.db
        .prepare("SELECT COUNT(*) as count FROM extracted_content_cache WHERE expires_at > ?")
        .get(now) as { count: number } | undefined;

      return row?.count ?? 0;
    } catch {
      return 0;
    }
  }
}

/**
 * 创建统一缓存实例
 */
export function createUnifiedCache(
  db: Database | null,
  options?: UnifiedCacheOptions
): UnifiedContentCache {
  return new UnifiedContentCache(db, options);
}
