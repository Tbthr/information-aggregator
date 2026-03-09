import type { Database } from "bun:sqlite";

import type { RawItem } from "../../types/index";

export function insertRawItems(db: Database, items: RawItem[]): void {
  const statement = db.prepare(
    `INSERT OR REPLACE INTO raw_items (
      id, source_id, title, url, snippet, author, published_at, fetched_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertMany = db.transaction((rows: RawItem[]) => {
    for (const row of rows) {
      statement.run(
        row.id,
        row.sourceId,
        row.title,
        row.url,
        row.snippet ?? null,
        row.author ?? null,
        row.publishedAt ?? null,
        row.fetchedAt,
        row.metadataJson,
      );
    }
  });

  insertMany(items);
}
