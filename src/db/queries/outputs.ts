import type { Database } from "bun:sqlite";

import type { OutputRecord } from "../../types/index";

export function createOutput(db: Database, output: OutputRecord): void {
  db.prepare(
    "INSERT INTO outputs (id, run_id, mode, format, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(output.id, output.runId, output.kind, output.format, output.body, output.createdAt);
}
