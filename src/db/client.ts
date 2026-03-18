import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 创建数据库连接并应用 schema
 * 项目未上线，使用单一 schema 文件
 */
export function createDb(path: string): Database {
  const db = new Database(path);
  db.exec(readFileSync(join(__dirname, "migrations", "001_init.sql"), "utf8"));
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
