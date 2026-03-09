import { describe, expect, test } from "bun:test";
import { dedupeNear } from "./dedupe-near";

describe("dedupeNear", () => {
  test("compresses highly similar titles in the same run", () => {
    const items = [
      { id: "1", normalizedTitle: "openai releases new model", canonicalUrl: "https://a.com", processedAt: "2026-03-09T00:00:00Z" },
      { id: "2", normalizedTitle: "openai released new model", canonicalUrl: "https://b.com", processedAt: "2026-03-09T00:10:00Z" },
    ];
    const deduped = dedupeNear(items);
    expect(deduped.length).toBe(1);
  });
});
