import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Database } from "bun:sqlite";
import type { ExtractedContent, AiEnrichmentResult } from "../types/index";

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

/**
 * Enrichment 结果存储接口
 */
export interface EnrichmentResultDb {
  id: string;
  normalizedItemId: string;
  extractedContent?: ExtractedContent;
  aiEnrichment?: AiEnrichmentResult;
  enrichedAt: string;
}

/**
 * 保存 enrichment 结果
 */
export function upsertEnrichmentResult(
  db: Database,
  normalizedItemId: string,
  extractedContent?: ExtractedContent,
  aiEnrichment?: AiEnrichmentResult,
): void {
  const id = `enrich-${normalizedItemId}`;
  const enrichedAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO enrichment_results
    (id, normalized_item_id, extracted_content_json, ai_enrichment_json, enriched_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    normalizedItemId,
    extractedContent ? JSON.stringify(extractedContent) : null,
    aiEnrichment ? JSON.stringify(aiEnrichment) : null,
    enrichedAt,
  );

  // 更新 normalized_items 表的 enrichment_id
  const updateStmt = db.prepare(`
    UPDATE normalized_items SET enrichment_id = ? WHERE id = ?
  `);
  updateStmt.run(id, normalizedItemId);
}

/**
 * 获取 enrichment 结果
 */
export function getEnrichmentResult(
  db: Database,
  normalizedItemId: string,
): EnrichmentResultDb | null {
  const stmt = db.prepare(`
    SELECT id, normalized_item_id as normalizedItemId, extracted_content_json, ai_enrichment_json, enriched_at
    FROM enrichment_results
    WHERE normalized_item_id = ?
  `);

  const row = stmt.get(normalizedItemId) as {
    id: string;
    normalizedItemId: string;
    extracted_content_json: string | null;
    ai_enrichment_json: string | null;
    enriched_at: string;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    normalizedItemId: row.normalizedItemId,
    extractedContent: row.extracted_content_json
      ? JSON.parse(row.extracted_content_json) as ExtractedContent
      : undefined,
    aiEnrichment: row.ai_enrichment_json
      ? JSON.parse(row.ai_enrichment_json) as AiEnrichmentResult
      : undefined,
    enrichedAt: row.enriched_at,
  };
}

/**
 * 保存提取的内容缓存
 */
export function setExtractedContentCache(
  db: Database,
  url: string,
  content: ExtractedContent,
  ttlSeconds = 86400,
): void {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO extracted_content_cache
    (url, content_json, cached_at, expires_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(url, JSON.stringify(content), now, expiresAt);
}

/**
 * 获取提取的内容缓存
 */
export function getExtractedContentCache(
  db: Database,
  url: string,
): ExtractedContent | null {
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    SELECT content_json, expires_at
    FROM extracted_content_cache
    WHERE url = ? AND expires_at > ?
  `);

  const row = stmt.get(url, now) as {
    content_json: string;
    expires_at: string;
  } | undefined;

  if (!row) {
    return null;
  }

  return JSON.parse(row.content_json) as ExtractedContent;
}

/**
 * 清理过期的内容缓存
 */
export function cleanupExpiredCache(db: Database): number {
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    DELETE FROM extracted_content_cache WHERE expires_at <= ?
  `);

  const result = stmt.run(now);
  return result.changes;
}
