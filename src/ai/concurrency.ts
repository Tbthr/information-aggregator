/**
 * 并发控制工具
 * 用于限制 AI 请求的并发数量
 */

import { getAiConfig } from "./config/load";

export interface ConcurrencyOptions {
  batchSize?: number;      // 批次大小，默认 5
  concurrency?: number;    // 最大并发，默认 2
}

/** 硬编码的默认值（配置不可用时的 fallback） */
const FALLBACK_BATCH_SIZE = 5;
const FALLBACK_CONCURRENCY = 2;

/**
 * 获取默认的并发配置（从环境变量）
 */
export function getDefaultConcurrencyOptions(): { batchSize: number; concurrency: number } {
  try {
    const config = getAiConfig();
    return {
      batchSize: config.batchSize ?? FALLBACK_BATCH_SIZE,
      concurrency: config.concurrency ?? FALLBACK_CONCURRENCY,
    };
  } catch {
    return { batchSize: FALLBACK_BATCH_SIZE, concurrency: FALLBACK_CONCURRENCY };
  }
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
  if (items.length === 0) {
    return [];
  }

  // 获取默认配置
  const defaults = getDefaultConcurrencyOptions();
  const { batchSize = defaults.batchSize, concurrency = defaults.concurrency } = options;

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
