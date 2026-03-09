import { describe, expect, test } from "bun:test";
import { dedupeExact } from "./dedupe-exact";

describe("dedupeExact", () => {
  test("keeps one item per exact dedup key", () => {
    const items = [
      { id: "1", exactDedupKey: "a", processedAt: "2026-03-09T00:00:00Z" },
      { id: "2", exactDedupKey: "a", processedAt: "2026-03-09T01:00:00Z" },
    ];
    const deduped = dedupeExact(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("2");
  });
});
