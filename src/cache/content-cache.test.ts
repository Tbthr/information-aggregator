import { beforeEach, describe, expect, test } from "bun:test";

import { ContentCache, createContentCache } from "./content-cache";

describe("ContentCache", () => {
  let cache: ContentCache<string>;

  beforeEach(() => {
    cache = new ContentCache({ ttl: 1, maxSize: 10 });
  });

  describe("基本操作", () => {
    test("设置和获取值", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    test("获取不存在的键返回 null", () => {
      expect(cache.get("nonexistent")).toBeNull();
    });

    test("删除键", () => {
      cache.set("key1", "value1");
      expect(cache.delete("key1")).toBe(true);
      expect(cache.get("key1")).toBeNull();
    });

    test("删除不存在的键返回 false", () => {
      expect(cache.delete("nonexistent")).toBe(false);
    });

    test("清空缓存", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    test("检查键是否存在", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
      expect(cache.has("nonexistent")).toBe(false);
    });
  });

  describe("键名规范化", () => {
    test("键名大小写不敏感", () => {
      cache.set("KEY1", "value1");
      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("KEY1")).toBe("value1");
    });

    test("键名去除前后空格", () => {
      cache.set("  key1  ", "value1");
      expect(cache.get("key1")).toBe("value1");
    });
  });

  describe("TTL 过期", () => {
    test("过期后返回 null", async () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");

      // 等待超过 TTL
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.get("key1")).toBeNull();
    });

    test("自定义 TTL", async () => {
      cache.set("key1", "value1", 2); // 2 秒
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(cache.get("key1")).toBe("value1");
    });

    test("获取时自动清理过期条目", async () => {
      cache.set("key1", "value1");
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // 获取会触发清理
      cache.get("key1");
      expect(cache.size()).toBe(0);
    });
  });

  describe("最大容量", () => {
    test("超过最大容量时删除最旧条目", () => {
      const smallCache = new ContentCache({ ttl: 10, maxSize: 3 });

      smallCache.set("key1", "value1");
      smallCache.set("key2", "value2");
      smallCache.set("key3", "value3");
      expect(smallCache.size()).toBe(3);

      // 添加第 4 个应该删除最旧的 key1
      smallCache.set("key4", "value4");
      expect(smallCache.size()).toBe(3);
      expect(smallCache.has("key1")).toBe(false);
      expect(smallCache.has("key4")).toBe(true);
    });
  });

  describe("批量操作", () => {
    test("批量获取", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      const results = cache.getBatch(["key1", "key2", "nonexistent"]);
      expect(results.size).toBe(2);
      expect(results.get("key1")).toBe("value1");
      expect(results.get("key2")).toBe("value2");
    });

    test("批量设置", () => {
      const entries = new Map([
        ["key1", "value1"],
        ["key2", "value2"],
      ]);
      cache.setBatch(entries);

      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("value2");
    });
  });

  describe("统计信息", () => {
    test("获取缓存统计", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain("key1");
      expect(stats.keys).toContain("key2");
    });
  });
});

describe("createContentCache", () => {
  test("创建默认配置的缓存", () => {
    const cache = createContentCache();
    expect(cache).toBeDefined();
    expect(cache.size()).toBe(0);
  });

  test("创建自定义配置的缓存", () => {
    const cache = createContentCache({ ttl: 100, maxSize: 50 });
    cache.set("key", "value");
    expect(cache.get("key")).toBe("value");
  });
});
