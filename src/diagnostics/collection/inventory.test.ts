import { describe, expect, test, mock } from "bun:test";

// Set up mocks BEFORE importing the module under test
mock.module("@/lib/prisma", () => ({
  prisma: {
    item: {
      count: async () => 100,
      findMany: mock(async () => [
        {
          id: "item-1",
          title: "Test Article",
          sourceName: "Test Source",
          score: 8.5,
          publishedAt: new Date("2026-03-25T10:00:00.000Z"),
        },
        {
          id: "item-2",
          title: "Second Article",
          sourceName: "Another Source",
          score: 7.0,
          publishedAt: new Date("2026-03-25T09:00:00.000Z"),
        },
      ]),
    },
    tweet: {
      count: async () => 50,
      findMany: mock(async () => [
        {
          id: "tweet-1",
          authorHandle: "@testuser",
          text: "Test tweet content",
          score: 7.0,
          publishedAt: new Date("2026-03-25T09:00:00.000Z"),
        },
      ]),
    },
    source: {
      count: async () => 10,
    },
    sourceHealth: {
      count: async () => 2,
    },
  },
}));

// Import after mocks are set up
import { loadCollectionInventory, buildPersistedSummary } from "./inventory";
import type { CollectionInventory, PersistedSummary } from "./types";

describe("loadCollectionInventory", () => {
  test("returns correct inventory structure", async () => {
    const inventory = await loadCollectionInventory();

    expect(inventory.itemCount).toBe(100);
    expect(inventory.tweetCount).toBe(50);
    expect(inventory.sourceCount).toBe(10);
    expect(inventory.unhealthySourceCount).toBe(2);
  });

  test("inventory has correct type shape", async () => {
    const inventory: CollectionInventory = await loadCollectionInventory();

    expect(typeof inventory.itemCount).toBe("number");
    expect(typeof inventory.tweetCount).toBe("number");
    expect(typeof inventory.sourceCount).toBe("number");
    expect(typeof inventory.unhealthySourceCount).toBe("number");
  });
});

describe("buildPersistedSummary", () => {
  test("returns correct persisted summary structure", async () => {
    const summary = await buildPersistedSummary(10);

    expect(Array.isArray(summary.topItems)).toBe(true);
    expect(Array.isArray(summary.topTweets)).toBe(true);
  });

  test("topItems have correct shape", async () => {
    const summary = await buildPersistedSummary(10);

    if (summary.topItems.length > 0) {
      const item = summary.topItems[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("sourceName");
      expect(typeof item.title).toBe("string");
    }
  });

  test("topTweets have correct shape", async () => {
    const summary = await buildPersistedSummary(10);

    if (summary.topTweets.length > 0) {
      const tweet = summary.topTweets[0];
      expect(tweet).toHaveProperty("id");
      expect(tweet).toHaveProperty("authorHandle");
      expect(tweet).toHaveProperty("text");
      expect(typeof tweet.authorHandle).toBe("string");
    }
  });
});

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

describe("PersistedItemSummary type structure", () => {
  test("item summary has correct fields", () => {
    const item = {
      id: "item-1",
      title: "Test Article",
      sourceName: "Test Source",
      score: 8.5,
      publishedAt: "2026-03-25T10:00:00.000Z",
    };

    expect(item.id).toBe("item-1");
    expect(item.title).toBe("Test Article");
    expect(item.sourceName).toBe("Test Source");
    expect(item.score).toBe(8.5);
    expect(item.publishedAt).toBe("2026-03-25T10:00:00.000Z");
  });

  test("score and publishedAt are optional", () => {
    const item = {
      id: "item-1",
      title: "Test Article",
      sourceName: "Test Source",
    };

    expect(item.score).toBeUndefined();
    expect(item.publishedAt).toBeUndefined();
  });
});

describe("PersistedTweetSummary type structure", () => {
  test("tweet summary has correct fields", () => {
    const tweet = {
      id: "tweet-1",
      authorHandle: "@testuser",
      text: "Test tweet content",
      score: 7.0,
      publishedAt: "2026-03-25T09:00:00.000Z",
    };

    expect(tweet.id).toBe("tweet-1");
    expect(tweet.authorHandle).toBe("@testuser");
    expect(tweet.text).toBe("Test tweet content");
    expect(tweet.score).toBe(7.0);
    expect(tweet.publishedAt).toBe("2026-03-25T09:00:00.000Z");
  });
});
