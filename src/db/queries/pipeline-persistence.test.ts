import { describe, expect, test } from "bun:test";

import { createDb } from "../client";
import { insertClusters } from "./clusters";
import { insertNormalizedItems } from "./normalized-items";
import { insertRawItems } from "./raw-items";

describe("pipeline persistence", () => {
  test("writes raw items, normalized items, and clusters", () => {
    const db = createDb(":memory:");

    insertRawItems(db, [
      {
        id: "raw-1",
        sourceId: "rss-1",
        title: "Hello",
        url: "https://example.com/1",
        fetchedAt: "2026-03-09T00:00:00Z",
        metadataJson: "{}",
      },
    ]);

    insertNormalizedItems(db, [
      {
        id: "norm-1",
        rawItemId: "raw-1",
        sourceId: "rss-1",
        canonicalUrl: "https://example.com/1",
        normalizedTitle: "hello",
        processedAt: "2026-03-09T00:01:00Z",
      },
    ]);

    insertClusters(db, [
      {
        id: "cluster-1",
        canonicalItemId: "norm-1",
        memberItemIds: ["norm-1"],
        dedupeMethod: "near",
        runId: "run-1",
      },
    ]);

    const rawRow = db.prepare("SELECT title, source_id FROM raw_items WHERE id = ?").get("raw-1") as {
      title: string;
      source_id: string;
    };
    const normalizedRow = db.prepare(
      "SELECT raw_item_id, canonical_url FROM normalized_items WHERE id = ?",
    ).get("norm-1") as {
      raw_item_id: string;
      canonical_url: string;
    };
    const clusterRow = db.prepare(
      "SELECT canonical_item_id, member_item_ids_json FROM clusters WHERE id = ?",
    ).get("cluster-1") as {
      canonical_item_id: string;
      member_item_ids_json: string;
    };

    expect(rawRow).toEqual({
      title: "Hello",
      source_id: "rss-1",
    });
    expect(normalizedRow).toEqual({
      raw_item_id: "raw-1",
      canonical_url: "https://example.com/1",
    });
    expect(clusterRow.canonical_item_id).toBe("norm-1");
    expect(JSON.parse(clusterRow.member_item_ids_json)).toEqual(["norm-1"]);
  });
});
