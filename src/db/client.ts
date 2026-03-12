import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDb(path: string): Database {
  const db = new Database(path);
  db.exec(readFileSync(join(__dirname, "migrations", "001_init.sql"), "utf8"));
  // 应用 enrichment migration
  const migrationPath = join(__dirname, "migrations", "002_add_enrichment.sql");
  try {
    db.exec(readFileSync(migrationPath, "utf8"));
  } catch (error) {
    // 如果表已存在，忽略错误
    if (!error?.toString().includes("already exists")) {
      console.warn("Migration 002 warning:", error);
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
