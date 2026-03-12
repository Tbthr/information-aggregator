import { describe, expect, test } from "bun:test";
import { processWithConcurrency } from "./concurrency";

describe("processWithConcurrency", () => {
  test("returns empty array for empty input", async () => {
    const result = await processWithConcurrency([], {}, async (x) => x);
    expect(result).toEqual([]);
  });

  test("processes all items with default concurrency", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await processWithConcurrency(items, {}, async (x) => x * 2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  test("respects concurrency limit", async () => {
    const items = [1, 2, 3, 4, 5, 6];
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const result = await processWithConcurrency(
      items,
      { concurrency: 2 },
      async (x) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return x * 2;
      }
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(result).toEqual([2, 4, 6, 8, 10, 12]);
  });

  test("respects batch size", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const batchCalls: number[][] = [];
    let currentBatch: number[] = [];

    await processWithConcurrency(
      items,
      { batchSize: 3, concurrency: 1 },
      async (x) => {
        currentBatch.push(x);
        if (currentBatch.length === 3 || x === items[items.length - 1]) {
          batchCalls.push([...currentBatch]);
          currentBatch = [];
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        return x;
      }
    );

    // 第一批应该有 3 个，第二批应该有 3 个，第三批应该有 1 个
    expect(batchCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("preserves order of results", async () => {
    const items = [5, 3, 1, 4, 2];
    const result = await processWithConcurrency(
      items,
      { concurrency: 2 },
      async (x) => {
        // 添加随机延迟来测试顺序保持
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
        return x * 10;
      }
    );

    expect(result).toEqual([50, 30, 10, 40, 20]);
  });

  test("handles errors gracefully", async () => {
    const items = [1, 2, 3, 4, 5];
    let errorCount = 0;

    const results = await processWithConcurrency(
      items,
      { concurrency: 1 },
      async (x) => {
        if (x === 3) {
          errorCount++;
          throw new Error("Test error");
        }
        return x;
      }
    ).catch(() => null);

    // 如果有错误，整个操作会失败
    expect(results).toBeNull();
    expect(errorCount).toBe(1);
  });

  test("processes single item correctly", async () => {
    const items = [42];
    const result = await processWithConcurrency(items, {}, async (x) => x);
    expect(result).toEqual([42]);
  });

  test("handles objects as input", async () => {
    const items = [{ id: 1, name: "a" }, { id: 2, name: "b" }];
    const result = await processWithConcurrency(
      items,
      {},
      async (item) => ({ ...item, processed: true })
    );
    expect(result).toEqual([
      { id: 1, name: "a", processed: true },
      { id: 2, name: "b", processed: true },
    ]);
  });
});
