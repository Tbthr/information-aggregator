import { describe, expect, test } from "bun:test";
import { runQuery } from "../run-query";
import type { RawItem, SourcePack } from "../../types";

describe("runQuery", () => {
  // Mock Pack 数据 - 注意：SourcePack 的 id 在顶层，不是 pack.id
  const mockPacks: SourcePack[] = [
    {
      id: "test",
      name: "Test Pack",
      sources: [{ type: "rss", url: "https://test.com/feed" }],
    },
  ];

  // Mock Item 数据
  const createMockItem = (id: string, fetchedAt: string): RawItem => ({
    id,
    sourceId: "test-com-feed",
    title: `Test Item ${id}`,
    url: `https://test.com/${id}`,
    fetchedAt,
    metadataJson: "{}",
  });

  test("should call collect with resolved sources and return items", async () => {
    const mockItems = [createMockItem("1", "2024-01-15T10:00:00Z")];

    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "24h" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => mockItems,
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("1");
  });

  test("should filter items by time window (1h)", async () => {
    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "1h" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => [
          createMockItem("old", "2024-01-15T10:00:00Z"), // 2 hours ago
          createMockItem("new", "2024-01-15T11:30:00Z"), // 30 min ago
        ],
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("new");
  });

  test("should filter items by time window (7d)", async () => {
    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "7d" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => [
          createMockItem("old", "2024-01-01T00:00:00Z"), // 14 days ago
          createMockItem("recent", "2024-01-14T00:00:00Z"), // 1 day ago
        ],
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("recent");
  });

  test("should include all items when window is 'all'", async () => {
    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "all" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => [
          createMockItem("old", "2024-01-01T00:00:00Z"),
          createMockItem("new", "2024-01-15T11:30:00Z"),
        ],
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    expect(result.items).toHaveLength(2);
  });

  test("should exclude items with invalid timestamp", async () => {
    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "24h" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => [
          { ...createMockItem("invalid", "not-a-date"), fetchedAt: "invalid" },
          createMockItem("valid", "2024-01-15T10:00:00Z"),
        ],
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("valid");
  });

  test("should normalize and dedupe items", async () => {
    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "24h" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => [
          createMockItem("item-1", "2024-01-15T10:00:00Z"),
          createMockItem("item-2", "2024-01-15T11:00:00Z"),
        ],
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    // Should have normalizedItems and rankedItems
    expect(result.normalizedItems.length).toBe(result.items.length);
    expect(result.rankedItems.length).toBe(result.items.length);
  });

  test("should build clusters from ranked items", async () => {
    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "24h" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => [createMockItem("item-1", "2024-01-15T10:00:00Z")],
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    expect(result.clusters).toBeDefined();
    expect(Array.isArray(result.clusters)).toBe(true);
  });

  test("should include selection and args in result", async () => {
    const result = await runQuery(
      { packIds: ["test"], viewId: "json", window: "24h" },
      {
        loadPacks: () => mockPacks,
        collectSources: async () => [],
        now: () => "2024-01-15T12:00:00Z",
      },
    );

    expect(result.args.packIds).toEqual(["test"]);
    expect(result.args.viewId).toBe("json");
    expect(result.args.window).toBe("24h");
    expect(result.selection).toBeDefined();
  });
});
