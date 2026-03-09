import type { Database } from "bun:sqlite";

import type { SourceHealth } from "../../types/index";

function ensureRow(db: Database, sourceId: string): void {
  db.prepare("INSERT OR IGNORE INTO source_health (source_id) VALUES (?)").run(sourceId);
}

export function recordSourceSuccess(db: Database, sourceId: string, timestamp: string): void {
  ensureRow(db, sourceId);
  db.prepare(
    "UPDATE source_health SET last_success_at = ?, last_error = NULL, consecutive_zero_item_runs = 0 WHERE source_id = ?",
  ).run(timestamp, sourceId);
}

export function recordSourceFailure(db: Database, sourceId: string, error: string, timestamp = new Date().toISOString()): void {
  ensureRow(db, sourceId);
  db.prepare(
    `UPDATE source_health
     SET last_failure_at = ?, last_error = ?, error_count = error_count + 1
     WHERE source_id = ?`,
  ).run(timestamp, error, sourceId);
}

export function recordSourceZeroItems(db: Database, sourceId: string): void {
  ensureRow(db, sourceId);
  db.prepare(
    "UPDATE source_health SET consecutive_zero_item_runs = consecutive_zero_item_runs + 1 WHERE source_id = ?",
  ).run(sourceId);
}

export function getSourceHealth(db: Database, sourceId: string): SourceHealth | null {
  const row = db.prepare("SELECT * FROM source_health WHERE source_id = ?").get(sourceId) as Record<string, unknown> | null;
  if (!row) {
    return null;
  }

  return {
    sourceId: String(row.source_id),
    lastSuccessAt: row.last_success_at ? String(row.last_success_at) : null,
    lastFailureAt: row.last_failure_at ? String(row.last_failure_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    errorCount: Number(row.error_count ?? 0),
    consecutiveZeroItemRuns: Number(row.consecutive_zero_item_runs ?? 0),
  };
}
