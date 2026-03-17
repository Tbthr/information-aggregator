import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";

import { itemsRoute } from "./routes/items";
import { packsRoute } from "./routes/packs";
import { viewsRoute } from "./routes/views";
import { createDb } from "../db/client";
import { getCliVersion } from "../cli/index";

/**
 * 创建 API 服务器
 */
export function createServer(options?: { dbPath?: string }) {
  const app = new Hono();
  const dbPath = options?.dbPath || "data/archive.db";

  // 中间件
  app.use("*", cors());
  app.use("*", logger());

  // API 路由
  app.route("/api/items", itemsRoute);
  app.route("/api/packs", packsRoute);
  app.route("/api/views", viewsRoute);

  // 健康检查
  app.get("/api/health", (c) => {
    const db = createDb(dbPath);
    try {
      const stats = db
        .prepare("SELECT COUNT(*) as count FROM raw_items")
        .get() as Record<string, unknown>;

      return c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: getCliVersion(),
        database: {
          connected: true,
          itemCount: Number(stats?.count ?? 0),
        },
      });
    } catch (error) {
      return c.json({
        status: "error",
        timestamp: new Date().toISOString(),
        version: getCliVersion(),
        database: {
          connected: false,
          itemCount: 0,
          error: String(error),
        },
      }, 500);
    } finally {
      db.close();
    }
  });

  // 静态文件服务（前端）
  // 开发模式下前端由 Vite 单独服务
  // 生产模式下前端文件在 frontend/dist 目录
  app.use(
    "/assets/*",
    serveStatic({
      root: "./frontend/dist/assets",
    }),
  );

  app.get("/", serveStatic({ path: "./frontend/dist/index.html" }));
  app.get("/*", serveStatic({ root: "./frontend/dist" }));

  return app;
}

export type AppType = ReturnType<typeof createServer>;
