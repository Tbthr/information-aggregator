import { describe, expect, test } from "bun:test";
import { createDb } from "../client";
import { createRun, finishRun } from "./runs";

describe("run persistence", () => {
  test("creates and finishes a run", () => {
    const db = createDb(":memory:");
    createRun(db, {
      id: "run-1",
      mode: "scan",
      sourceSelectionJson: "[]",
      paramsJson: "{}",
      status: "running",
      createdAt: "2026-03-09T00:00:00Z",
    });
    finishRun(db, "run-1", "succeeded", "2026-03-09T00:01:00Z");
    const row = db.prepare("SELECT status FROM runs WHERE id = ?").get("run-1") as { status: string };
    expect(row.status).toBe("succeeded");
  });
});
