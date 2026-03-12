CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  url TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS source_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_ids_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT,
  author TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS normalized_items (
  id TEXT PRIMARY KEY,
  raw_item_id TEXT NOT NULL,
  source_id TEXT,
  canonical_url TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  normalized_snippet TEXT,
  normalized_text TEXT,
  exact_dedup_key TEXT,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  canonical_item_id TEXT NOT NULL,
  member_item_ids_json TEXT NOT NULL,
  dedupe_method TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  url TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  source_selection_json TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  format TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_health (
  source_id TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_error TEXT,
  last_fetch_latency_ms INTEGER,
  last_item_count INTEGER,
  error_count INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_zero_item_runs INTEGER NOT NULL DEFAULT 0
);
