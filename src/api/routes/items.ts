import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createDb } from "../../db/client";
import { loadAllPacks } from "../../config/load-pack";
import { queryArchiveByWindow, getArchiveStats } from "../../archive/upsert";
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

  // 打开数据库
  const db = createDb("data/archive.db");

  try {
    // 加载 packs 获取 source 映射
    const packs = await loadAllPacks("config/packs");
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

    // 查询归档数据
    const offset = (query.page - 1) * query.pageSize;
    const rawItems = queryArchiveByWindow(db, query.window, {
      packIds,
      sourceIds: filteredSourceIds.length > 0 ? filteredSourceIds : undefined,
      limit: query.pageSize * 2, // 多获取一些用于排序过滤
      offset,
    });

    // 按 sourceType 过滤
    let filteredItems = rawItems;
    if (sourceTypes.length > 0) {
      // 需要从 metadata 解析 sourceType
      filteredItems = rawItems.filter((item) => {
        try {
          const meta = JSON.parse(item.metadataJson);
          return sourceTypes.includes(meta.sourceType);
        } catch {
          return false;
        }
      });
    }

    // 搜索过滤
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredItems = filteredItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchLower) ||
          item.snippet?.toLowerCase().includes(searchLower),
      );
    }

    // 排序
    if (query.sort === "recent") {
      filteredItems.sort((a, b) => {
        const aTime = a.publishedAt || a.fetchedAt;
        const bTime = b.publishedAt || b.fetchedAt;
        return bTime.localeCompare(aTime);
      });
    }

    // 分页
    const total = filteredItems.length;
    const pagedItems = filteredItems.slice(0, query.pageSize);

    // 构建 source 统计
    const sourceStats = new Map<string, { count: number; lastSuccess: string | null }>();
    for (const item of pagedItems) {
      const existing = sourceStats.get(item.sourceId) || { count: 0, lastSuccess: null };
      existing.count++;
      existing.lastSuccess = item.fetchedAt;
      sourceStats.set(item.sourceId, existing);
    }

    // 获取 pack 的 keywords 用于主题匹配
    const packKeywords = packIds.length > 0
      ? packIds.flatMap((packId) => packMap.get(packId)?.keywords ?? [])
      : [];

    // 格式化响应
    const items: ItemData[] = pagedItems.map((item) => {
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
        keywords: packKeywords,
        now: new Date().toISOString(),
      });

      return {
        id: item.id,
        title: item.title,
        url: item.url,
        canonicalUrl: item.url, // TODO: 从 normalized_items 获取
        source: {
          id: item.sourceId,
          type: meta.sourceType || "unknown",
          packId: meta.packId || "unknown",
        },
        publishedAt: item.publishedAt ?? null,
        fetchedAt: item.fetchedAt,
        firstSeenAt: item.fetchedAt, // TODO: 从 archive 字段获取
        lastSeenAt: item.fetchedAt,
        snippet: item.snippet || null,
        author: item.author || null,
        score: scoreInfo.finalScore,
        scores: {
          sourceWeight: scoreInfo.sourceWeight,
          freshness: scoreInfo.freshness,
          engagement: scoreInfo.engagement,
          topicMatch: scoreInfo.topicMatch,
          contentQuality: scoreInfo.contentQuality,
        },
        metadata: meta,
      };
    });

    const sources: SourceInfo[] = Array.from(sourceStats.entries()).map(([id, stats]) => ({
      id,
      type: "unknown", // TODO: 从 packs 获取
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
  } finally {
    db.close();
  }
});

/**
 * GET /api/items/saved - 获取已保存的内容项列表
 */
app.get("/saved", async (c) => {
  const db = createDb("data/archive.db");

  try {
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
          topicMatch: 0.5,
          contentQuality: 0.5,
        },
        metadata: meta,
      };
    });

    return c.json({
      success: true,
      data: { items, meta: { total: items.length } },
    });
  } finally {
    db.close();
  }
});

/**
 * GET /api/items/:id - 获取单个内容项
 */
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDb("data/archive.db");

  try {
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
        topicMatch: 0.5,
        contentQuality: 0.5,
      },
      metadata: meta,
    };

    return c.json({ success: true, data: item });
  } finally {
    db.close();
  }
});

/**
 * POST /api/items/:id/save - 保存内容项
 */
app.post("/:id/save", async (c) => {
  const id = c.req.param("id");
  const db = createDb("data/archive.db");

  try {
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
  } catch (error) {
    // 处理重复保存的情况 - 返回幂等成功（already saved）
    if (String(error).includes("UNIQUE constraint")) {
      const savedRow = db
        .prepare("SELECT saved_at FROM saved_items WHERE item_id = ?")
        .get(id) as Record<string, unknown> | undefined;
      return c.json({
        success: true,
        data: { savedAt: savedRow?.saved_at ?? new Date().toISOString(), already: true },
      });
    }
    throw error;
  } finally {
    db.close();
  }
});

/**
 * DELETE /api/items/:id/save - 取消保存内容项
 */
app.delete("/:id/save", async (c) => {
  const id = c.req.param("id");
  const db = createDb("data/archive.db");

  try {
    // 检查是否已保存
    const isSaved = await isItemSaved(db, id);
    if (!isSaved) {
      return c.json({ success: false, error: "Item not saved" }, 404);
    }

    await unsaveItem(db, id);
    return c.json({ success: true, data: { savedAt: null } });
  } finally {
    db.close();
  }
});

export { app as itemsRoute };
