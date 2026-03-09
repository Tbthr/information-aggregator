import type { Database } from "bun:sqlite";

import type { Cluster } from "../../types/index";

export function insertClusters(db: Database, clusters: Cluster[]): void {
  const statement = db.prepare(
    `INSERT OR REPLACE INTO clusters (
      id, run_id, canonical_item_id, member_item_ids_json, dedupe_method, title, summary, url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertMany = db.transaction((rows: Cluster[]) => {
    for (const row of rows) {
      statement.run(
        row.id,
        row.runId ?? null,
        row.canonicalItemId,
        JSON.stringify(row.memberItemIds),
        row.dedupeMethod,
        row.title ?? null,
        row.summary ?? null,
        row.url ?? null,
      );
    }
  });

  insertMany(clusters);
}
