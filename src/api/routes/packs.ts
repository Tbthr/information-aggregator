import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createDb } from "../../db/client";
import { loadAllPacks } from "../../config/load-pack";
import { PacksQuerySchema } from "../schemas/query";
import type { ApiResponse, PacksData, PackInfo } from "../types";
import type { PackPolicy } from "../../types/policy";
import { calculateItemScores } from "../scoring";
import type { RawItem } from "../../types/index";

const app = new Hono();

/**
 * GET /api/packs - 获取所有 Pack 列表
 */
app.get("/", zValidator("query", PacksQuerySchema), async (c) => {
  const query = c.req.valid("query");
  const packs = await loadAllPacks("config/packs");

  let packInfos: PackInfo[];

  if (query.includeStats) {
    const db = createDb("data/archive.db");
    try {
      packInfos = packs.map((pack) => {
        // 获取 pack 的所有 source IDs
        const sourceIds = pack.sources.map((s) => `${pack.id}::${s.url}`);

        // 统计数量（简化版，实际应该用 IN 查询）
        const stats = db
          .prepare(
            `SELECT COUNT(*) as count, MAX(fetched_at) as latest
             FROM raw_items
             WHERE source_id LIKE ?`,
          )
          .get(`${pack.id}::%`) as Record<string, unknown>;

        return {
          id: pack.id,
          name: pack.name,
          description: pack.description || null,
          keywords: pack.keywords || [],
          sourceCount: pack.sources.filter((s) => s.enabled !== false).length,
          itemCount: Number(stats?.count ?? 0),
          latestItem: stats?.latest ? String(stats.latest) : null,
        };
      });
    } finally {
      db.close();
    }
  } else {
    packInfos = packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description || null,
      keywords: pack.keywords || [],
      sourceCount: pack.sources.filter((s) => s.enabled !== false).length,
      itemCount: 0,
      latestItem: null,
    }));
  }

  const response: ApiResponse<PacksData> = {
    success: true,
    data: { packs: packInfos },
    meta: {
      query: {
        packIds: [],
        window: "all",
        page: 1,
        pageSize: packInfos.length,
        sort: "score",
      },
      timing: {
        generatedAt: new Date().toISOString(),
        latencyMs: 0,
      },
      pagination: {
        total: packInfos.length,
        page: 1,
        pageSize: packInfos.length,
        totalPages: 1,
      },
    },
  };

  return c.json(response);
});

/**
 * GET /api/packs/:id - 获取单个 Pack 详情
 */
app.get("/:id", async (c) => {
  const packId = c.req.param("id");
  const packs = await loadAllPacks("config/packs");
  const pack = packs.find((p) => p.id === packId);

  if (!pack) {
    return c.json({ success: false, error: "Pack not found" }, 404);
  }

  const db = createDb("data/archive.db");
  try {
    // 基础统计
    const basicStats = db
      .prepare(
        `SELECT COUNT(*) as count, MAX(fetched_at) as latest
         FROM raw_items
         WHERE source_id LIKE ?`,
      )
      .get(`${pack.id}::%`) as Record<string, unknown>;

    // 计算 totalItems
    const totalItems = Number(basicStats?.count ?? 0);

    // 计算 retainedItems（通过 filter_judgment 的项目）
    const retainedStats = db
      .prepare(
        `SELECT COUNT(DISTINCT ri.id) as count
	         FROM raw_items ri
	         LEFT JOIN normalized_items ni ON ni.raw_item_id = ri.id
	         LEFT JOIN enrichment_results er ON er.normalized_item_id = ni.id
	         WHERE ri.source_id LIKE ?
	           AND (er.filter_judgment_json IS NULL
	                OR JSON_EXTRACT(er.filter_judgment_json, '$.keepDecision') = 1
	                OR JSON_EXTRACT(er.filter_judgment_json, '$.keepDecision') = 'true')`,
	      )
	      .get(`${pack.id}::%`) as Record<string, unknown>;

    const retainedItems = Number(retainedStats?.count ?? totalItems);
    const retentionRate = totalItems > 0 ? Math.round((retainedItems / totalItems) * 100) / 100 : 1;

    // 计算 sourceComposition（来源类型分布）
    const sourceCompositionRows = db
      .prepare(
        `SELECT JSON_EXTRACT(metadata_json, '$.sourceType') as sourceType, COUNT(*) as count
         FROM raw_items
         WHERE source_id LIKE ?
         GROUP BY sourceType`,
      )
      .all(`${pack.id}::%`) as Array<{ sourceType: string | null; count: number }>;

    const sourceComposition: Record<string, number> = {};
    for (const row of sourceCompositionRows) {
      const type = row.sourceType || "unknown";
      sourceComposition[type] = (sourceComposition[type] || 0) + row.count;
    }

    // 获取 featuredItems（按分数排序的前5条）
    const featuredRows = db
      .prepare(
        `SELECT id, source_id, title, url, snippet, author, published_at, fetched_at, metadata_json
         FROM raw_items
         WHERE source_id LIKE ?
         ORDER BY fetched_at DESC
         LIMIT 20`,
      )
      .all(`${pack.id}::%`) as Array<Record<string, unknown>>;

    // 计算分数并排序
    const now = new Date().toISOString();
    const itemsWithScores = featuredRows.map((row) => {
      const rawItem: RawItem = {
        id: String(row.id),
        sourceId: String(row.source_id),
        title: String(row.title),
        url: String(row.url),
        fetchedAt: String(row.fetched_at),
        metadataJson: String(row.metadata_json || "{}"),
        snippet: row.snippet ? String(row.snippet) : undefined,
        publishedAt: row.published_at ? String(row.published_at) : undefined,
        author: row.author ? String(row.author) : undefined,
      };

      const scoreInfo = calculateItemScores(rawItem, {
        keywords: pack.keywords,
        now,
      });

      return {
        id: rawItem.id,
        title: rawItem.title,
        url: rawItem.url,
        snippet: rawItem.snippet || null,
        author: rawItem.author || null,
        publishedAt: rawItem.publishedAt || null,
        score: scoreInfo.finalScore,
      };
    });

    // 按分数排序取前5
    const featuredItems = itemsWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const packInfo: PackInfo = {
      id: pack.id,
      name: pack.name,
      description: pack.description || null,
      keywords: pack.keywords || [],
      sourceCount: pack.sources.filter((s) => s.enabled !== false).length,
      itemCount: Number(basicStats?.count ?? 0),
      latestItem: basicStats?.latest ? String(basicStats.latest) : null,
    };

    // 扩展字段
    const policy: PackPolicy = pack.policy || { mode: "filter_then_assist" };
    const stats = {
      sourceCount: packInfo.sourceCount,
      totalItems,
      retainedItems,
      retentionRate,
    };

    return c.json({
      success: true,
      data: {
        pack: packInfo,
        policy,
        stats,
        sourceComposition,
        featuredItems,
        sources: pack.sources.map((s) => ({
          type: s.type,
          url: s.url,
          description: s.description,
          enabled: s.enabled !== false,
        })),
      },
    });
  } finally {
    db.close();
  }
});

export { app as packsRoute };
