import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { insertSource, listEnabledSources, listSources, upsertSource } from "./sources";

describe("source queries", () => {
  test("inserts and lists sources", () => {
    const db = createDb(":memory:");
    insertSource(db, {
      id: "rss-1",
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
    upsertSource(db, { id: "s1", type: "rss", enabled: false, configJson: "{}", url: "" });
    upsertSource(db, { id: "s1", type: "rss", enabled: true, configJson: "{}", url: "" });
    expect(listEnabledSources(db)).toHaveLength(1);
  });

  test("persists policy json when provided", () => {
    const db = createDb(":memory:");
    upsertSource(db, {
      id: "s1",
      type: "rss",
      enabled: true,
      configJson: "{}",
      url: "https://example.com/feed.xml",
      policy: {
        mode: "assist_only",
        filterPrompt: "只做辅助",
      },
    });

    const row = db
      .prepare("SELECT policy_json FROM sources WHERE id = ?")
      .get("s1") as { policy_json: string | null };

    expect(row.policy_json).toBe('{"mode":"assist_only","filterPrompt":"只做辅助"}');
  });
});
