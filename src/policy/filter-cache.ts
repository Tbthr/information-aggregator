/**
 * Policy Filter 缓存模块
 * 用于缓存 AI 过滤判断结果，避免重复调用
 */

import type { Database } from "bun:sqlite";
import type { FilterJudgment } from "../types/ai-response";

/**
 * 生成内容指纹
 * 使用 URL + publishedAt 组合生成唯一指纹
 */
export function generateFingerprint(url: string, publishedAt: string | null): string {
  // 使用 URL 和发布日期的前 10 个字符（YYYY-MM-DD）生成指纹
  const datePart = publishedAt ? publishedAt.substring(0, 10) : "no-date";
  return `${url}|${datePart}`;
}

/**
 * 查询缓存的过滤判断结果
 * @param db - 数据库实例
 * @param itemId - 条目 ID
 * @param itemFingerprint - 内容指纹
 * @returns 缓存的判断结果，如果不存在则返回 null
 */
export async function getCachedJudgment(
  db: Database,
  itemId: string,
  itemFingerprint: string,
): Promise<FilterJudgment | null> {
  const stmt = db.prepare(`
    SELECT filter_judgment_json, item_fingerprint
    FROM enrichment_results
    WHERE normalized_item_id = ?
  `);

  const row = stmt.get(itemId) as {
    filter_judgment_json: string | null;
    item_fingerprint: string | null;
  } | undefined;

  if (!row || !row.filter_judgment_json) {
    return null;
  }

  // 验证指纹是否匹配（如果指纹存在）
  if (row.item_fingerprint && row.item_fingerprint !== itemFingerprint) {
    // 指纹不匹配，缓存失效
    return null;
  }

  try {
    return JSON.parse(row.filter_judgment_json) as FilterJudgment;
  } catch {
    // JSON 解析失败，返回 null
    return null;
  }
}

/**
 * 保存过滤判断结果到缓存
 * @param db - 数据库实例
 * @param itemId - 条目 ID
 * @param judgment - 判断结果
 * @param itemFingerprint - 内容指纹
 */
export async function saveJudgment(
  db: Database,
  itemId: string,
  judgment: FilterJudgment,
  itemFingerprint: string,
): Promise<void> {
  // 首先检查是否已存在记录
  const checkStmt = db.prepare(`
    SELECT id FROM enrichment_results WHERE normalized_item_id = ?
  `);
  const existing = checkStmt.get(itemId) as { id: string } | undefined;

  if (existing) {
    // 更新现有记录
    const updateStmt = db.prepare(`
      UPDATE enrichment_results
      SET filter_judgment_json = ?, item_fingerprint = ?
      WHERE normalized_item_id = ?
    `);
    updateStmt.run(JSON.stringify(judgment), itemFingerprint, itemId);
  } else {
    // 插入新记录
    const insertStmt = db.prepare(`
      INSERT INTO enrichment_results
      (id, normalized_item_id, filter_judgment_json, item_fingerprint, enriched_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const id = `enrich-${itemId}`;
    const enrichedAt = new Date().toISOString();
    insertStmt.run(id, itemId, JSON.stringify(judgment), itemFingerprint, enrichedAt);
  }
}

/**
 * 批量查询缓存的过滤判断结果
 * @param db - 数据库实例
 * @param items - 条目数组，包含 itemId 和 fingerprint
 * @returns Map<itemId, FilterJudgment>，只返回有缓存的条目
 */
export async function batchGetCachedJudgments(
  db: Database,
  items: Array<{ itemId: string; fingerprint: string }>,
): Promise<Map<string, FilterJudgment>> {
  const result = new Map<string, FilterJudgment>();

  if (items.length === 0) {
    return result;
  }

  // 构建 IN 子句
  const placeholders = items.map(() => "?").join(",");
  const itemIds = items.map((item) => item.itemId);

  const stmt = db.prepare(`
    SELECT normalized_item_id, filter_judgment_json, item_fingerprint
    FROM enrichment_results
    WHERE normalized_item_id IN (${placeholders})
  `);

  const rows = stmt.all(...itemIds) as Array<{
    normalized_item_id: string;
    filter_judgment_json: string | null;
    item_fingerprint: string | null;
  }>;

  // 创建 fingerprint lookup map
  const fingerprintMap = new Map(items.map((item) => [item.itemId, item.fingerprint]));

  for (const row of rows) {
    if (!row.filter_judgment_json) {
      continue;
    }

    // 验证指纹
    const expectedFingerprint = fingerprintMap.get(row.normalized_item_id);
    if (row.item_fingerprint && expectedFingerprint && row.item_fingerprint !== expectedFingerprint) {
      // 指纹不匹配，跳过
      continue;
    }

    try {
      const judgment = JSON.parse(row.filter_judgment_json) as FilterJudgment;
      result.set(row.normalized_item_id, judgment);
    } catch {
      // JSON 解析失败，跳过
    }
  }

  return result;
}

/**
 * 批量保存过滤判断结果
 * @param db - 数据库实例
 * @param judgments - Map<itemId, { judgment, fingerprint }>
 */
export async function batchSaveJudgments(
  db: Database,
  judgments: Map<string, { judgment: FilterJudgment; fingerprint: string }>,
): Promise<void> {
  // 使用事务批量更新
  db.exec("BEGIN TRANSACTION");

  try {
    const selectStmt = db.prepare(`
      SELECT id FROM enrichment_results WHERE normalized_item_id = ?
    `);

    const updateStmt = db.prepare(`
      UPDATE enrichment_results
      SET filter_judgment_json = ?, item_fingerprint = ?
      WHERE normalized_item_id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO enrichment_results
      (id, normalized_item_id, filter_judgment_json, item_fingerprint, enriched_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const [itemId, { judgment, fingerprint }] of judgments) {
      const existing = selectStmt.get(itemId) as { id: string } | undefined;

      if (existing) {
        updateStmt.run(JSON.stringify(judgment), fingerprint, itemId);
      } else {
        const id = `enrich-${itemId}`;
        const enrichedAt = new Date().toISOString();
        insertStmt.run(id, itemId, JSON.stringify(judgment), fingerprint, enrichedAt);
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
