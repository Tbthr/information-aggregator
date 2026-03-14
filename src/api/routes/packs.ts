import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createDb } from "../../db/client";
import { loadAllPacks } from "../../config/load-pack";
import { PacksQuerySchema } from "../schemas/query";
import type { ApiResponse, PacksData, PackInfo } from "../types";

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
    const stats = db
      .prepare(
        `SELECT COUNT(*) as count, MAX(fetched_at) as latest
         FROM raw_items
         WHERE source_id LIKE ?`,
      )
      .get(`${pack.id}::%`) as Record<string, unknown>;

    const packInfo: PackInfo = {
      id: pack.id,
      name: pack.name,
      description: pack.description || null,
      keywords: pack.keywords || [],
      sourceCount: pack.sources.filter((s) => s.enabled !== false).length,
      itemCount: Number(stats?.count ?? 0),
      latestItem: stats?.latest ? String(stats.latest) : null,
    };

    return c.json({
      success: true,
      data: {
        pack: packInfo,
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
