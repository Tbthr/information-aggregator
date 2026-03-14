-- Migration 003: Add archive support
-- 为 raw_items 添加归档字段，支持 first_seen_at / last_seen_at 追踪

-- 添加归档字段
ALTER TABLE raw_items ADD COLUMN first_seen_at TEXT;
ALTER TABLE raw_items ADD COLUMN last_seen_at TEXT;

-- 创建索引加速时间窗口查询
CREATE INDEX IF NOT EXISTS idx_raw_items_first_seen ON raw_items(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_raw_items_last_seen ON raw_items(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_raw_items_source_id ON raw_items(source_id);
CREATE INDEX IF NOT EXISTS idx_raw_items_published ON raw_items(published_at);

-- 数据源归档统计表
CREATE TABLE IF NOT EXISTS source_archive_stats (
  source_id TEXT PRIMARY KEY,
  total_items INTEGER NOT NULL DEFAULT 0,
  first_item_at TEXT,
  latest_item_at TEXT,
  last_archive_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);
