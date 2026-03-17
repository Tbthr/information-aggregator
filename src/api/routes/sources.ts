import { Hono } from "hono";
import { createDb } from "../../db/client";
import { buildSourceDetail } from "../../views/source-detail";

const app = new Hono();

/**
 * GET /api/sources/:id - 获取来源详情
 *
 * 返回来源的元信息、策略配置、统计信息和最近内容
 */
app.get("/:id", async (c) => {
  const startTime = Date.now();
  const sourceId = c.req.param("id");
  const db = createDb("data/archive.db");

  try {
    // 构建来源详情视图
    const viewModel = await buildSourceDetail({ db, sourceId });

    if (!viewModel) {
      return c.json({
        success: false,
        error: "Source not found",
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        source: viewModel.source,
        policy: viewModel.policy,
        stats: viewModel.stats,
        filterReasons: viewModel.filterReasons,
        recentItems: viewModel.recentItems,
      },
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    });
  } finally {
    db.close();
  }
});

export { app as sourcesRoute };
