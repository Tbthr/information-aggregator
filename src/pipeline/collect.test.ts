import { describe, expect, test } from "bun:test";
import { collectSources } from "./collect";

describe("collectSources", () => {
  test("collects from multiple sources and flattens results", async () => {
    const items = await collectSources(
      [{ id: "s1", name: "A", type: "rss", enabled: true, configJson: "{}", url: "https://a.com/feed" }],
      {
        adapters: {
          rss: async () => [
            {
              id: "item-1",
              sourceId: "s1",
              title: "Hello",
              url: "https://a.com/1",
              fetchedAt: "2026-03-09T00:00:00Z",
              metadataJson: "{}",
            },
          ],
        },
      },
    );
    expect(items).toHaveLength(1);
  });
});
