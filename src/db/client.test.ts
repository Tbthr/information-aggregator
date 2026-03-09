import { describe, expect, test } from "bun:test";
import { createDb } from "./client";

describe("createDb", () => {
  test("opens database and creates core tables", () => {
    const db = createDb(":memory:");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    expect(tables.some((t) => t.name === "sources")).toBe(true);
  });
});
