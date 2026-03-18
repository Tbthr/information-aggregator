import type { Database } from "bun:sqlite";

import type { RunRecord, RunStatus } from "../../types/index";

export function createRun(db: Database, run: Required<Pick<RunRecord, "id" | "kind" | "status">> & {
  sourceSelectionJson: string;
  paramsJson: string;
  createdAt: string;
}): void {
  db.prepare(
    "INSERT INTO runs (id, kind, mode, source_selection_json, params_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(run.id, run.kind, run.kind, run.sourceSelectionJson, run.paramsJson, run.status, run.createdAt);
}

export function finishRun(db: Database, runId: string, status: RunStatus, finishedAt: string): void {
  db.prepare("UPDATE runs SET status = ?, finished_at = ? WHERE id = ?").run(status, finishedAt, runId);
}
