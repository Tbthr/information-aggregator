import type { Database } from "bun:sqlite";

import type { NormalizedItem } from "../../types/index";

export function insertNormalizedItems(db: Database, items: NormalizedItem[]): void {
  const statement = db.prepare(
    `INSERT OR REPLACE INTO normalized_items (
      id, raw_item_id, source_id, canonical_url, normalized_title, normalized_snippet,
      normalized_text, exact_dedup_key, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertMany = db.transaction((rows: NormalizedItem[]) => {
    for (const row of rows) {
      statement.run(
        row.id,
        row.rawItemId,
        row.sourceId ?? null,
        row.canonicalUrl,
        row.normalizedTitle,
        row.normalizedSnippet ?? null,
        row.normalizedText ?? null,
        row.exactDedupKey ?? null,
        row.processedAt ?? null,
      );
    }
  });

  insertMany(items);
}
