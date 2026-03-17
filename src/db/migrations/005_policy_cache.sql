-- Migration 005: Policy Filter 缓存优化
-- 添加 fingerprint 字段和索引，支持高效的缓存查询

-- enrichment_results 表添加 item_fingerprint 字段
-- 用于生成内容指纹，验证缓存是否仍然有效（URL + publishedAt）
ALTER TABLE enrichment_results ADD COLUMN item_fingerprint TEXT;

-- 索引：按 fingerprint 查询缓存
CREATE INDEX IF NOT EXISTS idx_enrichment_fingerprint ON enrichment_results(item_fingerprint);

-- 索引：支持按 URL + publishedAt 组合查询
CREATE INDEX IF NOT EXISTS idx_enrichment_url_date ON enrichment_results(item_id, fetched_at);

-- 更新现有 enrichment_results 的 fingerprint（如果 URL 可用）
-- 使用 fetched_at 作为 fallback
UPDATE enrichment_results
SET item_fingerprint = item_id || '|' || substr(fetched_at, 1, 10)
WHERE item_fingerprint IS NULL
  AND item_id IS NOT NULL;
