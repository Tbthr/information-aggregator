import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDb(path: string): Database {
  const db = new Database(path);
  db.exec(readFileSync(join(__dirname, "migrations", "001_init.sql"), "utf8"));

  // 应用 enrichment migration
  const migration002 = join(__dirname, "migrations", "002_add_enrichment.sql");
  try {
    db.exec(readFileSync(migration002, "utf8"));
  } catch (error) {
    if (!error?.toString().includes("already exists")) {
      console.warn("Migration 002 warning:", error);
    }
  }

  // 应用 archive migration
  const migration003 = join(__dirname, "migrations", "003_add_archive.sql");
  try {
    db.exec(readFileSync(migration003, "utf8"));
  } catch (error) {
    // 如果字段已存在，忽略错误
    if (!error?.toString().includes("duplicate column")) {
      console.warn("Migration 003 warning:", error);
    }
  }

  return db;
}

// 重导出 enrichment 查询函数（向后兼容）
export type { EnrichmentResultDb } from "./queries/enrichment";
export {
  upsertEnrichmentResult,
  getEnrichmentResult,
  setExtractedContentCache,
  getExtractedContentCache,
  cleanupExpiredCache,
} from "./queries/enrichment";
