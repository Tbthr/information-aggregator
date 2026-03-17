-- Migration 004: Editorial 功能支持
-- 添加收藏功能和 editorial 扩展字段

-- 收藏项目表
-- 存储用户收藏的 item，支持按 pack 分组
CREATE TABLE IF NOT EXISTS saved_items (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  pack_id TEXT,
  saved_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES normalized_items(id) ON DELETE CASCADE
);

-- 索引：按 item 查询收藏状态
CREATE INDEX IF NOT EXISTS idx_saved_items_item ON saved_items(item_id);

-- 索引：按保存时间排序
CREATE INDEX IF NOT EXISTS idx_saved_items_saved_at ON saved_items(saved_at);

-- enrichment_results 表添加 filter_judgment_json 字段
-- 存储 AI 过滤判断结果
ALTER TABLE enrichment_results ADD COLUMN filter_judgment_json TEXT;

-- sources 表添加 policy_json 字段
-- 存储数据源级别的过滤策略配置
ALTER TABLE sources ADD COLUMN policy_json TEXT;

-- source_packs 表添加 policy_json 字段
-- 存储 pack 级别的过滤策略配置
ALTER TABLE source_packs ADD COLUMN policy_json TEXT;
