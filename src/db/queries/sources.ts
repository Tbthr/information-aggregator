import type { Database } from "bun:sqlite";

import type { Source } from "../../types/index";

function toRecord(row: Record<string, unknown>): Source {
  return {
    id: String(row.id),
    type: String(row.type) as Source["type"],
    enabled: Boolean(row.enabled),
    url: row.url ? String(row.url) : "",
    configJson: String(row.config_json ?? "{}"),
    policy: row.policy_json ? JSON.parse(String(row.policy_json)) : undefined,
  };
}

export function insertSource(db: Database, source: Source): void {
  db.prepare(
    "INSERT INTO sources (id, type, enabled, url, config_json, policy_json) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    source.id,
    source.type,
    source.enabled ? 1 : 0,
    source.url ?? null,
    source.configJson ?? "{}",
    source.policy ? JSON.stringify(source.policy) : null,
  );
}

export function upsertSource(db: Database, source: Source): void {
  db.prepare(
    `INSERT INTO sources (id, type, enabled, url, config_json, policy_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       enabled = excluded.enabled,
       url = excluded.url,
       config_json = excluded.config_json,
       policy_json = excluded.policy_json`,
  ).run(
    source.id,
    source.type,
    source.enabled ? 1 : 0,
    source.url ?? null,
    source.configJson ?? "{}",
    source.policy ? JSON.stringify(source.policy) : null,
  );
}

export function listSources(db: Database): Source[] {
  return (db.prepare("SELECT * FROM sources ORDER BY id").all() as Record<string, unknown>[]).map(toRecord);
}

export function listEnabledSources(db: Database): Source[] {
  return (db.prepare("SELECT * FROM sources WHERE enabled = 1 ORDER BY id").all() as Record<string, unknown>[]).map(toRecord);
}
