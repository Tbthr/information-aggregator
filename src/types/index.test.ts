import { describe, expect, test } from "bun:test";
import type { RawItem, RunMode } from "./index";

describe("core types", () => {
  test("RunMode includes scan and digest", () => {
    const modes: RunMode[] = ["scan", "digest"];
    expect(modes).toHaveLength(2);
  });

  test("RawItem supports basic ingestion fields", () => {
    const item: RawItem = {
      id: "item-1",
      sourceId: "source-1",
      title: "Example",
      url: "https://example.com",
      fetchedAt: "2026-03-09T00:00:00Z",
      metadataJson: "{}",
    };
    expect(item.sourceId).toBe("source-1");
  });
});
