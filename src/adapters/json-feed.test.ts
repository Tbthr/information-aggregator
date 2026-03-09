import { describe, expect, test } from "bun:test";
import { parseJsonFeedItems } from "./json-feed";

describe("parseJsonFeedItems", () => {
  test("extracts items from JSON Feed", () => {
    const payload = {
      version: "https://jsonfeed.org/version/1.1",
      items: [{ id: "1", title: "Hello", url: "https://example.com/1" }],
    };
    const items = parseJsonFeedItems(payload, "json-1");
    expect(items[0]?.url).toBe("https://example.com/1");
  });
});
