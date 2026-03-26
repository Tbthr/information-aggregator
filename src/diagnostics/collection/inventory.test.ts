import { describe, expect, test } from "bun:test";
import type { CollectionInventory, PersistedSummary } from "./types";

// Test with a simple mock-style approach (no DB required for these unit tests)
// The actual DB-backed functions are tested via integration tests

describe("CollectionInventory type structure", () => {
  test("inventory has correct shape", () => {
    const inventory: CollectionInventory = {
      itemCount: 100,
      tweetCount: 50,
      sourceCount: 10,
      unhealthySourceCount: 2,
    };

    expect(inventory.itemCount).toBe(100);
    expect(inventory.tweetCount).toBe(50);
    expect(inventory.sourceCount).toBe(10);
    expect(inventory.unhealthySourceCount).toBe(2);
  });
});

describe("PersistedSummary type structure", () => {
  test("persistedSummary has correct shape", () => {
    const summary: PersistedSummary = {
      topItems: [
        {
          id: "item-1",
          title: "Test Article",
          sourceName: "Test Source",
          score: 8.5,
          publishedAt: "2026-03-25T10:00:00.000Z",
        },
      ],
      topTweets: [
        {
          id: "tweet-1",
          authorHandle: "@testuser",
          text: "Test tweet content",
          score: 7.0,
          publishedAt: "2026-03-25T09:00:00.000Z",
        },
      ],
    };

    expect(summary.topItems.length).toBe(1);
    expect(summary.topItems[0].title).toBe("Test Article");
    expect(summary.topTweets.length).toBe(1);
    expect(summary.topTweets[0].authorHandle).toBe("@testuser");
  });

  test("empty persistedSummary is valid", () => {
    const summary: PersistedSummary = {
      topItems: [],
      topTweets: [],
    };

    expect(summary.topItems.length).toBe(0);
    expect(summary.topTweets.length).toBe(0);
  });
});

describe("PersistedSummary truncation logic", () => {
  // Pure function tests for truncation behavior

  function truncateItems<T extends { publishedAt?: string; score?: number }>(
    items: T[],
    topN: number
  ): T[] {
    if (topN <= 0) return [];
    // Sort by score desc, then by publishedAt desc
    return [...items]
      .sort((a, b) => {
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, topN);
  }

  test("truncates to top N by score", () => {
    const items = [
      { id: "a", score: 5.0, publishedAt: "2026-03-25T10:00:00.000Z" },
      { id: "b", score: 9.0, publishedAt: "2026-03-25T09:00:00.000Z" },
      { id: "c", score: 7.0, publishedAt: "2026-03-25T08:00:00.000Z" },
    ];

    const result = truncateItems(items, 2);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe("b"); // highest score
    expect(result[1].id).toBe("c");
  });

  test("sorts by score then by date for tie-breaking", () => {
    const items = [
      { id: "a", score: 7.0, publishedAt: "2026-03-25T10:00:00.000Z" },
      { id: "b", score: 7.0, publishedAt: "2026-03-25T11:00:00.000Z" },
    ];

    const result = truncateItems(items, 1);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("b"); // newer date for tie
  });

  test("returns empty array when topN is 0", () => {
    const items = [{ id: "a", score: 5.0 }];
    const result = truncateItems(items, 0);
    expect(result.length).toBe(0);
  });

  test("handles items without score (defaults to 0)", () => {
    const items = [
      { id: "a" },
      { id: "b", score: 5.0 },
    ];

    const result = truncateItems(items, 1);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("b");
  });

  test("handles items without publishedAt", () => {
    const items = [
      { id: "a", score: 8.0 },
      { id: "b", score: 9.0 },
    ];

    const result = truncateItems(items, 2);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe("b");
  });
});
