/**
 * 并发控制工具
 * 用于限制 AI 请求的并发数量
 */

import { loadAiSettings } from "./config/load";

export interface ConcurrencyOptions {
  batchSize?: number;      // 批次大小，默认 5
  concurrency?: number;    // 最大并发，默认 2
}

/** 硬编码的默认值（配置不可用时的 fallback） */
const FALLBACK_BATCH_SIZE = 5;
const FALLBACK_CONCURRENCY = 2;

/** 缓存已加载的默认配置 */
let cachedDefaults: { batchSize: number; concurrency: number } | null = null;

/**
 * 获取默认的并发配置
 * 优先从 settings.yaml 读取，否则使用 fallback 值
 */
export async function getDefaultConcurrencyOptions(): Promise<{ batchSize: number; concurrency: number }> {
  if (cachedDefaults) return cachedDefaults;

  try {
    const settings = await loadAiSettings();
    cachedDefaults = {
      batchSize: settings?.defaultBatchSize ?? FALLBACK_BATCH_SIZE,
      concurrency: settings?.defaultConcurrency ?? FALLBACK_CONCURRENCY,
    };
    return cachedDefaults;
  } catch {
    cachedDefaults = { batchSize: FALLBACK_BATCH_SIZE, concurrency: FALLBACK_CONCURRENCY };
    return cachedDefaults;
  }
}

/**
 * 清除配置缓存（用于测试）
 */
export function clearConcurrencyCache(): void {
  cachedDefaults = null;
}

/**
 * 使用并发控制处理一批项目
 * @param items 要处理的项目数组
 * @param options 并发选项
 * @param handler 处理每个项目的函数
 * @returns 处理结果数组
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  options: ConcurrencyOptions,
  handler: (item: T) => Promise<R>
): Promise<R[]> {
  // 获取默认配置
  const defaults = await getDefaultConcurrencyOptions();
  const { batchSize = defaults.batchSize, concurrency = defaults.concurrency } = options;

  if (items.length === 0) {
    return [];
  }

  const results: R[] = [];

  // 分批处理
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // 在批次内使用并发控制
    const batchResults = await processBatchWithConcurrency(batch, concurrency, handler);
    results.push(...batchResults);
  }

  return results;
}

/**
 * 使用并发控制处理单个批次
 */
async function processBatchWithConcurrency<T, R>(
  items: T[],
  maxConcurrency: number,
  handler: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function processNext(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await handler(items[index]);
    }
  }

  // 启动并发工作线程
  const workers = Array(Math.min(maxConcurrency, items.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
  return results;
}
