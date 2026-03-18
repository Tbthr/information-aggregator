import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../db/connection";
import { getPacks } from "../../config/pack-cache";
import { queryArchiveByWindow, countArchiveByWindow } from "../../archive/upsert";
import { ItemsQuerySchema } from "../schemas/query";
import type { ApiResponse, ItemsData, ItemData, SourceInfo } from "../types";
import { calculateItemScores } from "../scoring";
import type { RawItem } from "../../types/index";
import { saveItem, unsaveItem, getSavedItems, isItemSaved } from "../../db/queries/saved-items";

const app = new Hono();

/**
 * GET /api/items - 查询归档内容项
 */
app.get("/", zValidator("query", ItemsQuerySchema), async (c) => {
  const startTime = Date.now();
  const query = c.req.valid("query");

  // 解析参数
  const packIds = query.packs?.split(",").filter(Boolean) ?? [];
  const sourceIds = query.sources?.split(",").filter(Boolean) ?? [];
  const sourceTypes = query.sourceTypes?.split(",").filter(Boolean) ?? [];

  // 使用单例数据库连接
  const db = getDb("data/archive.db");

  // 加载 packs 获取 source 映射（使用缓存）
  const packs = await getPacks("config/packs");
  const packMap = new Map(packs.map((p) => [p.id, p]));

  // 构建 sourceId 过滤条件
  let filteredSourceIds = sourceIds;
  if (packIds.length > 0) {
    const packSourceIds = packIds.flatMap(
      (packId) => packMap.get(packId)?.sources.map((s) => `${packId}::${s.url}`) ?? [],
    );
    filteredSourceIds = sourceIds.length > 0
      ? sourceIds.filter((id) => packSourceIds.includes(id))
      : packSourceIds;
  }

  // 先获取总数（用于精确分页）
  const total = countArchiveByWindow(db, query.window, {
    sourceIds: filteredSourceIds.length > 0 ? filteredSourceIds : undefined,
    sourceTypes: sourceTypes.length > 0 ? sourceTypes : undefined,
    search: query.search,
  });

  // 查询归档数据（使用 SQL 层过滤）
  const offset = (query.page - 1) * query.pageSize;
  const rawItems = queryArchiveByWindow(db, query.window, {
    sourceIds: filteredSourceIds.length > 0 ? filteredSourceIds : undefined,
    sourceTypes: sourceTypes.length > 0 ? sourceTypes : undefined,
    search: query.search,
    limit: query.pageSize,
    offset,
  });

  // 排序（如果需要）
  let sortedItems = rawItems;
  if (query.sort === "recent") {
    sortedItems = [...rawItems].sort((a, b) => {
      const aTime = a.publishedAt || a.fetchedAt;
      const bTime = b.publishedAt || b.fetchedAt;
      return bTime.localeCompare(aTime);
    });
  }

  // 构建 source 统计
  const sourceStats = new Map<string, { count: number; lastSuccess: string | null }>();
  for (const item of sortedItems) {
    const existing = sourceStats.get(item.sourceId) || { count: 0, lastSuccess: null };
    existing.count++;
    existing.lastSuccess = item.fetchedAt;
    sourceStats.set(item.sourceId, existing);
  }

  // 格式化响应
  const items: ItemData[] = sortedItems.map((item) => {
    const meta = JSON.parse(item.metadataJson || "{}");
    const rawItem: RawItem = {
      id: item.id,
      sourceId: item.sourceId,
      title: item.title,
      url: item.url,
      fetchedAt: item.fetchedAt,
      metadataJson: item.metadataJson,
      snippet: item.snippet,
      publishedAt: item.publishedAt,
      author: item.author,
    };

    // 计算分数
    const scoreInfo = calculateItemScores(rawItem, {
      now: new Date().toISOString(),
    });

    return {
      id: item.id,
      title: item.title,
      url: item.url,
      canonicalUrl: item.url,
      source: {
        id: item.sourceId,
        type: meta.sourceType || "unknown",
        packId: meta.packId || "unknown",
      },
      publishedAt: item.publishedAt ?? null,
      fetchedAt: item.fetchedAt,
      firstSeenAt: item.fetchedAt,
      lastSeenAt: item.fetchedAt,
      snippet: item.snippet || null,
      author: item.author || null,
      score: scoreInfo.finalScore,
      scores: {
        sourceWeight: scoreInfo.sourceWeight,
        freshness: scoreInfo.freshness,
        engagement: scoreInfo.engagement,
        contentQuality: scoreInfo.contentQuality,
      },
      metadata: meta,
    };
  });

  const sources: SourceInfo[] = Array.from(sourceStats.entries()).map(([id, stats]) => ({
    id,
    type: "unknown",
    packId: "unknown",
    itemCount: stats.count,
    health: {
      lastSuccessAt: stats.lastSuccess,
      lastFailureAt: null,
      consecutiveFailures: 0,
    },
  }));

  const response: ApiResponse<ItemsData> = {
    success: true,
    data: { items, sources },
    meta: {
      query: {
        packIds,
        window: query.window,
        sourceIds: filteredSourceIds.length > 0 ? filteredSourceIds : undefined,
        sourceTypes: sourceTypes.length > 0 ? sourceTypes : undefined,
        page: query.page,
        pageSize: query.pageSize,
        sort: query.sort,
        search: query.search,
      },
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      },
      pagination: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      },
    },
  };

  return c.json(response);
});

/**
 * GET /api/items/saved - 获取已保存的内容项列表
 */
app.get("/saved", async (c) => {
  const db = getDb("data/archive.db");

  // 获取已保存的 item ids
  const savedItems = await getSavedItems(db);

  if (savedItems.length === 0) {
    return c.json({
      success: true,
      data: { items: [], meta: { total: 0 } },
    });
  }

  // 关联 raw_items 获取完整内容
  const itemIds = savedItems.map((si) => si.itemId);
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM raw_items WHERE id IN (${placeholders})`)
    .all(...itemIds) as Record<string, unknown>[];

  // 构建返回数据
  const items: ItemData[] = rows.map((row) => {
    const meta = JSON.parse(String(row.metadata_json || "{}"));
    return {
      id: String(row.id),
      title: String(row.title),
      url: String(row.url),
      canonicalUrl: String(row.url),
      source: {
        id: String(row.source_id),
        type: meta.sourceType || "unknown",
        packId: meta.packId || "unknown",
      },
      publishedAt: row.published_at ? String(row.published_at) : null,
      fetchedAt: String(row.fetched_at),
      firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : String(row.fetched_at),
      lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : String(row.fetched_at),
      snippet: row.snippet ? String(row.snippet) : null,
      author: row.author ? String(row.author) : null,
      score: 5,
      scores: {
        sourceWeight: 1,
        freshness: 0.5,
        engagement: 0.5,
        contentQuality: 0.5,
      },
      metadata: meta,
    };
  });

  return c.json({
    success: true,
    data: { items, meta: { total: items.length } },
  });
});

/**
 * GET /api/items/:id - 获取单个内容项
 */
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb("data/archive.db");

  const row = db
    .prepare("SELECT * FROM raw_items WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!row) {
    return c.json({ success: false, error: "Item not found" }, 404);
  }

  const meta = JSON.parse(String(row.metadata_json || "{}"));
  const item: ItemData = {
    id: String(row.id),
    title: String(row.title),
    url: String(row.url),
    canonicalUrl: String(row.url),
    source: {
      id: String(row.source_id),
      type: meta.sourceType || "unknown",
      packId: meta.packId || "unknown",
    },
    publishedAt: row.published_at ? String(row.published_at) : null,
    fetchedAt: String(row.fetched_at),
    firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : String(row.fetched_at),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : String(row.fetched_at),
    snippet: row.snippet ? String(row.snippet) : null,
    author: row.author ? String(row.author) : null,
    score: 5,
    scores: {
      sourceWeight: 1,
      freshness: 0.5,
      engagement: 0.5,
      contentQuality: 0.5,
    },
    metadata: meta,
  };

  return c.json({ success: true, data: item });
});

/**
 * POST /api/items/:id/save - 保存内容项
 */
app.post("/:id/save", async (c) => {
  const id = c.req.param("id");
  const db = getDb("data/archive.db");

  // 检查 item 是否存在
  const row = db
    .prepare("SELECT id FROM raw_items WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!row) {
    return c.json({ success: false, error: "Item not found" }, 404);
  }

  // 保存 item
  await saveItem(db, id);

  // 获取保存时间
  const savedRow = db
    .prepare("SELECT saved_at FROM saved_items WHERE item_id = ?")
    .get(id) as Record<string, unknown> | undefined;

  return c.json({
    success: true,
    data: { savedAt: savedRow?.saved_at ?? new Date().toISOString() },
  });
});

/**
 * DELETE /api/items/:id/save - 取消保存内容项
 */
app.delete("/:id/save", async (c) => {
  const id = c.req.param("id");
  const db = getDb("data/archive.db");

  // 检查是否已保存
  const isSaved = await isItemSaved(db, id);
  if (!isSaved) {
    return c.json({ success: false, error: "Item not saved" }, 404);
  }

  await unsaveItem(db, id);
  return c.json({ success: true, data: { savedAt: null } });
});

export { app as itemsRoute };
