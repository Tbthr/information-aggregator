import type { Database } from "bun:sqlite";

import { generateSourceId } from "../../config/source-id";
import type { SourcePack } from "../../types/index";

export interface SourcePackRecord {
  id: string;
  name: string;
  sourceIdsJson: string;
  policyJson: string | null;
}

export function upsertSourcePack(
  db: Database,
  pack: {
    id: string;
    name: string;
    sourceIds: string[];
    policyJson?: string;
  },
): void {
  db.prepare(
    `INSERT INTO source_packs (id, name, source_ids_json, policy_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       source_ids_json = excluded.source_ids_json,
       policy_json = excluded.policy_json`,
  ).run(
    pack.id,
    pack.name,
    JSON.stringify(pack.sourceIds),
    pack.policyJson ?? null,
  );
}

export function syncPacksToDb(db: Database, packs: SourcePack[]): void {
  const sync = db.transaction((items: SourcePack[]) => {
    for (const pack of items) {
      upsertSourcePack(db, {
        id: pack.id,
        name: pack.name,
        sourceIds: pack.sources.map((source) => generateSourceId(source.url)),
        policyJson: pack.policy ? JSON.stringify(pack.policy) : undefined,
      });
    }
  });

  sync(packs);
}
