import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { insertSource, listEnabledSources, listSources, upsertSource } from "./sources";

describe("source queries", () => {
  test("inserts and lists sources", () => {
    const db = createDb(":memory:");
    insertSource(db, {
      id: "rss-1",
      name: "Example RSS",
      type: "rss",
      enabled: true,
      url: "https://example.com/feed.xml",
      configJson: "{}",
    });
    const sources = listSources(db);
    expect(sources).toHaveLength(1);
  });

  test("upserts and filters enabled sources", () => {
    const db = createDb(":memory:");
    upsertSource(db, { id: "s1", name: "A", type: "rss", enabled: false, configJson: "{}" });
    upsertSource(db, { id: "s1", name: "A2", type: "rss", enabled: true, configJson: "{}" });
    expect(listEnabledSources(db)).toHaveLength(1);
  });
});
