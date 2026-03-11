import { describe, expect, test } from "bun:test";
import type { RawItem, RunKind } from "./index";

describe("core types", () => {
  test("RunKind supports query execution semantics", () => {
    const kinds: RunKind[] = ["query"];
    expect(kinds).toHaveLength(1);
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
