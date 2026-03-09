import type { Database } from "bun:sqlite";

import type { Source } from "../../types/index";

function toRecord(row: Record<string, unknown>): Source {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type),
    enabled: Boolean(row.enabled),
    url: row.url ? String(row.url) : undefined,
    configJson: String(row.config_json ?? "{}"),
    weight: typeof row.weight === "number" ? row.weight : Number(row.weight ?? 1),
  };
}

export function insertSource(db: Database, source: Source): void {
  db.prepare(
    "INSERT INTO sources (id, name, type, enabled, url, config_json, weight) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    source.id,
    source.name,
    source.type,
    source.enabled ? 1 : 0,
    source.url ?? null,
    source.configJson ?? "{}",
    source.weight ?? 1,
  );
}

export function upsertSource(db: Database, source: Source): void {
  db.prepare(
    `INSERT INTO sources (id, name, type, enabled, url, config_json, weight)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       enabled = excluded.enabled,
       url = excluded.url,
       config_json = excluded.config_json,
       weight = excluded.weight`,
  ).run(
    source.id,
    source.name,
    source.type,
    source.enabled ? 1 : 0,
    source.url ?? null,
    source.configJson ?? "{}",
    source.weight ?? 1,
  );
}

export function listSources(db: Database): Source[] {
  return (db.prepare("SELECT * FROM sources ORDER BY id").all() as Record<string, unknown>[]).map(toRecord);
}

export function listEnabledSources(db: Database): Source[] {
  return (db.prepare("SELECT * FROM sources WHERE enabled = 1 ORDER BY id").all() as Record<string, unknown>[]).map(toRecord);
}
