-- Information Aggregator 数据库 Schema
-- 合并自 001-005 migrations，项目未上线，简化为单一 schema 文件

-- ==================== 核心表 ====================

-- 数据源定义
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  url TEXT,
  config_json TEXT DEFAULT '{}',
  policy_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 数据源 Pack 定义
CREATE TABLE IF NOT EXISTS source_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source_ids_json TEXT NOT NULL,
  policy_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 原始抓取内容
CREATE TABLE IF NOT EXISTS raw_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  author TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  first_seen_at TEXT,
  last_seen_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

-- 标准化后的内容
CREATE TABLE IF NOT EXISTS normalized_items (
  id TEXT PRIMARY KEY,
  raw_item_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  linked_canonical_url TEXT,
  relationship_to_canonical TEXT,
  is_discussion_source INTEGER DEFAULT 0,
  normalized_title TEXT,
  normalized_snippet TEXT,
  normalized_text TEXT,
  exact_dedup_key TEXT,
  processed_at TEXT,
  source_id TEXT,
  title TEXT,
  url TEXT,
  metadata_json TEXT,
  source_type TEXT,
  content_type TEXT,
  engagement_score REAL DEFAULT 0,
  enrichment_id TEXT,
  FOREIGN KEY (raw_item_id) REFERENCES raw_items(id) ON DELETE CASCADE
);

-- 聚类/去重结果
CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  canonical_item_id TEXT NOT NULL,
  member_item_ids_json TEXT NOT NULL,
  dedupe_method TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 查询运行记录
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  mode TEXT DEFAULT 'query',
  started_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  status TEXT DEFAULT 'pending',
  source_selection_json TEXT,
  params_json TEXT
);

-- 输出结果
CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  format TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- 数据源健康状态
CREATE TABLE IF NOT EXISTS source_health (
  source_id TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_error TEXT,
  last_fetch_latency_ms INTEGER,
  last_item_count INTEGER,
  error_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  consecutive_zero_item_runs INTEGER DEFAULT 0,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 数据源归档统计
CREATE TABLE IF NOT EXISTS source_archive_stats (
  source_id TEXT PRIMARY KEY,
  total_items INTEGER DEFAULT 0,
  first_item_at TEXT,
  latest_item_at TEXT,
  last_archive_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- ==================== Enrichment 相关 ====================

-- Enrichment 结果表
CREATE TABLE IF NOT EXISTS enrichment_results (
  id TEXT PRIMARY KEY,
  normalized_item_id TEXT NOT NULL UNIQUE,
  extracted_content_json TEXT,
  ai_enrichment_json TEXT,
  filter_judgment_json TEXT,
  item_fingerprint TEXT,
  enriched_at TEXT NOT NULL,
  FOREIGN KEY (normalized_item_id) REFERENCES normalized_items(id) ON DELETE CASCADE
);

-- 提取内容缓存表（URL → ExtractedContent）
CREATE TABLE IF NOT EXISTS extracted_content_cache (
  url TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- ==================== Editorial 相关 ====================

-- 用户收藏的内容
CREATE TABLE IF NOT EXISTS saved_items (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  pack_id TEXT,
  saved_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES normalized_items(id) ON DELETE CASCADE
);

-- Highlights 结果
CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  trends_json TEXT,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- ==================== Policy Cache ====================

-- Policy 过滤缓存
CREATE TABLE IF NOT EXISTS policy_filter_cache (
  item_id TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  result INTEGER NOT NULL,
  filtered_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (item_id, policy_hash),
  FOREIGN KEY (item_id) REFERENCES raw_items(id) ON DELETE CASCADE
);

-- ==================== 索引 ====================

-- raw_items 索引
CREATE INDEX IF NOT EXISTS idx_raw_items_source_id ON raw_items(source_id);
CREATE INDEX IF NOT EXISTS idx_raw_items_first_seen ON raw_items(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_raw_items_last_seen ON raw_items(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_raw_items_fetched_at ON raw_items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_raw_items_published ON raw_items(published_at);

-- normalized_items 索引
CREATE INDEX IF NOT EXISTS idx_normalized_items_enrichment ON normalized_items(enrichment_id);

-- enrichment 索引
CREATE INDEX IF NOT EXISTS idx_enrichment_fingerprint ON enrichment_results(item_fingerprint);

-- 缓存表索引
CREATE INDEX IF NOT EXISTS idx_extracted_content_cache_expires ON extracted_content_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_policy_filter_cache_expires ON policy_filter_cache(expires_at);

-- saved_items 索引
CREATE INDEX IF NOT EXISTS idx_saved_items_item ON saved_items(item_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_saved_at ON saved_items(saved_at);

-- JSON 字段索引（SQLite 3.38+）
CREATE INDEX IF NOT EXISTS idx_raw_items_metadata_source_type
  ON raw_items(json_extract(metadata_json, '$.sourceType'));
