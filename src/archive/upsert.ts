import type { Database } from "bun:sqlite";

import type { RawItem } from "../types/index";

export interface ArchiveResult {
  newCount: number;
  updateCount: number;
  totalCount: number;
}

/**
 * 归档写入：UPSERT 模式
 * - 新条目：插入并设置 first_seen_at / last_seen_at
 * - 已有条目：更新 last_seen_at 和 fetched_at
 */
export function archiveRawItems(
  db: Database,
  items: RawItem[],
  fetchedAt: string,
): ArchiveResult {
  // 检查哪些是新增的
  const existingIds = new Set(
    db
      .prepare(`SELECT id FROM raw_items WHERE id IN (${items.map(() => "?").join(",")})`)
      .values(...items.map((i) => i.id))
      .flat(),
  );

  const upsertStatement = db.prepare(`
    INSERT INTO raw_items (
      id, source_id, title, url, snippet, author,
      published_at, fetched_at, metadata_json,
      first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      fetched_at = excluded.fetched_at
  `);

  let newCount = 0;
  let updateCount = 0;

  const upsertMany = db.transaction((rows: RawItem[]) => {
    for (const row of rows) {
      const isNew = !existingIds.has(row.id);
      if (isNew) {
        newCount++;
      } else {
        updateCount++;
      }

      upsertStatement.run(
        row.id,
        row.sourceId,
        row.title,
        row.url,
        row.snippet ?? null,
        row.author ?? null,
        row.publishedAt ?? null,
        row.fetchedAt,
        row.metadataJson,
        isNew ? fetchedAt : null, // first_seen_at 只在新增时设置
        fetchedAt, // last_seen_at 总是更新
      );
    }
  });

  upsertMany(items);

  return {
    newCount,
    updateCount,
    totalCount: items.length,
  };
}

/**
 * 查询选项
 */
export interface QueryArchiveOptions {
  packIds?: string[];
  sourceIds?: string[];
  sourceTypes?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * 按时间窗口查询归档数据
 * 支持 sourceType 和 search 参数下推到 SQL
 */
export function queryArchiveByWindow(
  db: Database,
  window: string,
  options?: QueryArchiveOptions,
): RawItem[] {
  const windowClause = buildWindowClause(window);
  const params: (string | number)[] = [];

  let sql = `SELECT * FROM raw_items WHERE ${windowClause}`;

  if (options?.sourceIds?.length) {
    sql += ` AND source_id IN (${options.sourceIds.map(() => "?").join(",")})`;
    params.push(...options.sourceIds);
  }

  // sourceType 过滤下推到 SQL
  if (options?.sourceTypes?.length) {
    sql += ` AND json_extract(metadata_json, '$.sourceType') IN (${options.sourceTypes.map(() => "?").join(",")})`;
    params.push(...options.sourceTypes);
  }

  // 搜索下推到 SQL
  if (options?.search) {
    sql += ` AND (title LIKE ? OR snippet LIKE ?)`;
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm);
  }

  // TODO: packIds 需要关联 source_packs 表
  // 暂时在应用层过滤

  sql += ` ORDER BY COALESCE(published_at, first_seen_at) DESC`;

  if (options?.limit) {
    sql += ` LIMIT ?`;
    params.push(options.limit);
    if (options?.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }
  }

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];

  return rows.map(rowToRawItem);
}

/**
 * 按时间窗口统计归档数据数量
 * 用于分页计算
 */
export function countArchiveByWindow(
  db: Database,
  window: string,
  options?: Omit<QueryArchiveOptions, "limit" | "offset">,
): number {
  const windowClause = buildWindowClause(window);
  const params: (string | number)[] = [];

  let sql = `SELECT COUNT(*) as count FROM raw_items WHERE ${windowClause}`;

  if (options?.sourceIds?.length) {
    sql += ` AND source_id IN (${options.sourceIds.map(() => "?").join(",")})`;
    params.push(...options.sourceIds);
  }

  // sourceType 过滤下推到 SQL
  if (options?.sourceTypes?.length) {
    sql += ` AND json_extract(metadata_json, '$.sourceType') IN (${options.sourceTypes.map(() => "?").join(",")})`;
    params.push(...options.sourceTypes);
  }

  // 搜索下推到 SQL
  if (options?.search) {
    sql += ` AND (title LIKE ? OR snippet LIKE ?)`;
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm);
  }

  const row = db.prepare(sql).get(...params) as { count: number };
  return row?.count ?? 0;
}

/**
 * 构建 SQL 时间窗口条件
 */
function buildWindowClause(window: string): string {
  switch (window) {
    case "1h":
      return `datetime(first_seen_at) >= datetime('now', '-1 hour')`;
    case "6h":
      return `datetime(first_seen_at) >= datetime('now', '-6 hours')`;
    case "24h":
      return `datetime(first_seen_at) >= datetime('now', '-24 hours')`;
    case "7d":
      return `datetime(first_seen_at) >= datetime('now', '-7 days')`;
    case "30d":
      return `datetime(first_seen_at) >= datetime('now', '-30 days')`;
    case "all":
      return `1=1`;
    default:
      return `datetime(first_seen_at) >= datetime('now', '-24 hours')`;
  }
}

/**
 * 数据库行转 RawItem
 */
function rowToRawItem(row: Record<string, unknown>): RawItem {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    title: String(row.title),
    url: String(row.url),
    fetchedAt: String(row.fetched_at),
    metadataJson: String(row.metadata_json),
    snippet: row.snippet ? String(row.snippet) : undefined,
    publishedAt: row.published_at ? String(row.published_at) : undefined,
    author: row.author ? String(row.author) : undefined,
  };
}

/**
 * 获取归档统计
 */
export function getArchiveStats(db: Database): {
  totalItems: number;
  oldestItem: string | null;
  newestItem: string | null;
} {
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        MIN(first_seen_at) as oldest,
        MAX(first_seen_at) as newest
       FROM raw_items
       WHERE first_seen_at IS NOT NULL`,
    )
    .get() as Record<string, unknown>;

  return {
    totalItems: Number(stats?.total ?? 0),
    oldestItem: stats?.oldest ? String(stats.oldest) : null,
    newestItem: stats?.newest ? String(stats.newest) : null,
  };
}
