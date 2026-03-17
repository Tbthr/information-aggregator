-- Migration 005: Policy Filter 缓存优化
-- 添加 fingerprint 字段和索引，支持高效的缓存查询

-- enrichment_results 表添加 item_fingerprint 字段
-- 用于生成内容指纹，验证缓存是否仍然有效（URL + publishedAt）
ALTER TABLE enrichment_results ADD COLUMN item_fingerprint TEXT;

-- 索引：按 fingerprint 查询缓存
CREATE INDEX IF NOT EXISTS idx_enrichment_fingerprint ON enrichment_results(item_fingerprint);

-- 更新现有 enrichment_results 的 fingerprint（如果 URL 可用）
-- 使用 normalized_item_id 作为保底，避免旧数据没有可回溯的 URL 信息
UPDATE enrichment_results
SET item_fingerprint = normalized_item_id || '|legacy'
WHERE item_fingerprint IS NULL
  AND normalized_item_id IS NOT NULL;
