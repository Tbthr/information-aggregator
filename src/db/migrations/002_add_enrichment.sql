-- Migration 002: 深度 Enrichment 支持
-- 添加 enrichment 结果表和内容缓存表

-- enrichment 结果表
-- 存储每个 normalized_item 的 enrichment 结果
CREATE TABLE IF NOT EXISTS enrichment_results (
  id TEXT PRIMARY KEY,
  normalized_item_id TEXT NOT NULL UNIQUE,
  extracted_content_json TEXT,
  ai_enrichment_json TEXT,
  enriched_at TEXT NOT NULL,
  FOREIGN KEY (normalized_item_id) REFERENCES normalized_items(id) ON DELETE CASCADE
);

-- normalized_items 表添加 enrichment 相关字段（冗余字段，便于查询）
ALTER TABLE normalized_items ADD COLUMN enrichment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_normalized_items_enrichment ON normalized_items(enrichment_id);

-- 提取内容缓存表（独立表，便于管理和 TTL 清理）
CREATE TABLE IF NOT EXISTS extracted_content_cache (
  url TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- 为缓存表创建索引，便于过期清理
CREATE INDEX IF NOT EXISTS idx_extracted_content_cache_expires ON extracted_content_cache(expires_at);
