/**
 * 内容缓存模块
 * 提供基于 URL 的内存缓存，支持 TTL 过期控制
 */

import type { ExtractedContent } from "../pipeline/extract-content";

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  value: T;
  cachedAt: number;
  expiresAt: number;
}

/**
 * 缓存选项
 */
export interface ContentCacheOptions {
  ttl?: number;     // 过期时间（秒），默认 86400（24 小时）
  maxSize?: number; // 最大缓存条目数，默认 1000
}

/**
 * 内容缓存类
 */
export class ContentCache<T = ExtractedContent> {
  private cache: Map<string, CacheEntry<T>>;
  private ttl: number;
  private maxSize: number;

  constructor(options: ContentCacheOptions = {}) {
    this.cache = new Map();
    this.ttl = options.ttl ?? 86400; // 默认 24 小时
    this.maxSize = options.maxSize ?? 1000;
  }

  /**
   * 生成缓存键
   */
  private normalizeKey(key: string): string {
    return key.trim().toLowerCase();
  }

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 确保缓存不超过最大容量
   */
  private enforceMaxSize(): void {
    if (this.cache.size <= this.maxSize) {
      return;
    }

    // 按过期时间排序，删除最旧的条目
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

    const toDelete = entries.slice(0, this.cache.size - this.maxSize);
    for (const [key] of toDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | null {
    const normalizedKey = this.normalizeKey(key);
    const entry = this.cache.get(normalizedKey);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(normalizedKey);
      return null;
    }

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T, customTtl?: number): void {
    const normalizedKey = this.normalizeKey(key);
    const now = Date.now();
    const ttl = customTtl ?? this.ttl;

    this.cache.set(normalizedKey, {
      value,
      cachedAt: now,
      expiresAt: now + ttl * 1000,
    });

    this.cleanup();
    this.enforceMaxSize();
  }

  /**
   * 检查键是否存在（且未过期）
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 删除缓存条目
   */
  delete(key: string): boolean {
    const normalizedKey = this.normalizeKey(key);
    return this.cache.delete(normalizedKey);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    this.cleanup();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 批量获取
   */
  getBatch(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * 批量设置
   */
  setBatch(entries: Map<string, T>, customTtl?: number): void {
    for (const [key, value] of entries.entries()) {
      this.set(key, value, customTtl);
    }
  }
}

/**
 * 创建默认的内容缓存实例
 */
export function createContentCache(options?: ContentCacheOptions): ContentCache<ExtractedContent> {
  return new ContentCache<ExtractedContent>(options);
}
