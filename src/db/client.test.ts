import { describe, expect, test } from "bun:test";
import { createDb } from "./client";

describe("createDb", () => {
  test("opens database and creates core tables", () => {
    const db = createDb(":memory:");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    expect(tables.some((t) => t.name === "sources")).toBe(true);
  });

  test("applies policy cache migration fields and indexes", () => {
    const db = createDb(":memory:");
    const columns = db.prepare("PRAGMA table_info(enrichment_results)").all() as Array<{ name: string }>;
    const indexes = db.prepare("PRAGMA index_list(enrichment_results)").all() as Array<{ name: string }>;

    expect(columns.some((column) => column.name === "item_fingerprint")).toBe(true);
    expect(indexes.some((index) => index.name === "idx_enrichment_fingerprint")).toBe(true);
  });
});
