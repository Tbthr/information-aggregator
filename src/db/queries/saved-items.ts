import type { Database } from "bun:sqlite";

export interface SavedItem {
  id: string;
  itemId: string;
  packId: string | null;
  savedAt: string;
}

/**
 * 保存一个 item 到 saved_items 表
 */
export async function saveItem(
  db: Database,
  itemId: string,
  packId?: string,
): Promise<void> {
  const id = crypto.randomUUID();
  const savedAt = new Date().toISOString();
  const statement = db.prepare(
    `INSERT INTO saved_items (id, item_id, pack_id, saved_at) VALUES (?, ?, ?, ?)`,
  );
  statement.run(id, itemId, packId ?? null, savedAt);
}

/**
 * 取消保存一个 item
 */
export async function unsaveItem(db: Database, itemId: string): Promise<void> {
  const statement = db.prepare(`DELETE FROM saved_items WHERE item_id = ?`);
  statement.run(itemId);
}

/**
 * 获取已保存的 items 列表
 */
export async function getSavedItems(
  db: Database,
  limit?: number,
): Promise<SavedItem[]> {
  const sql = limit
    ? `SELECT id, item_id as itemId, pack_id as packId, saved_at as savedAt FROM saved_items ORDER BY saved_at DESC LIMIT ?`
    : `SELECT id, item_id as itemId, pack_id as packId, saved_at as savedAt FROM saved_items ORDER BY saved_at DESC`;

  const statement = db.prepare(sql);
  const rows = limit ? statement.all(limit) : statement.all();
  return rows as SavedItem[];
}

/**
 * 检查一个 item 是否已被保存
 */
export async function isItemSaved(db: Database, itemId: string): Promise<boolean> {
  const statement = db.prepare(
    `SELECT 1 FROM saved_items WHERE item_id = ? LIMIT 1`,
  );
  const result = statement.get(itemId);
  return result !== undefined && result !== null;
}
