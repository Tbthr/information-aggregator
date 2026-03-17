import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { createDb } from "../../db/client";
import { saveItem, unsaveItem, getSavedItems, isItemSaved } from "../../db/queries/saved-items";

// 测试用的精简 items route, 使用注入的数据库实例
function createTestItemsRoute(db: Database) {
  const app = new Hono();

  // GET /api/items/saved - 获取已保存的内容项列表
  app.get("/saved", async (c) => {
    const savedItems = await getSavedItems(db);

    if (savedItems.length === 0) {
      return c.json({
        success: true,
        data: { items: [], meta: { total: 0 } },
      });
    }

    const itemIds = savedItems.map((si) => si.itemId);
    const placeholders = itemIds.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM raw_items WHERE id IN (${placeholders})`)
      .all(...itemIds) as Record<string, unknown>[];

    const items = rows.map((row) => {
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
  });

  // POST /api/items/:id/save - 保存内容项
  app.post("/:id/save", async (c) => {
    const id = c.req.param("id");

    const row = db
      .prepare("SELECT id FROM raw_items WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!row) {
      return c.json({ success: false, error: "Item not found" }, 404);
    }

    try {
      await saveItem(db, id);

      const savedRow = db
        .prepare("SELECT saved_at FROM saved_items WHERE item_id = ?")
        .get(id) as Record<string, unknown> | undefined;

      return c.json({
        success: true,
        data: { savedAt: savedRow?.saved_at ?? new Date().toISOString() },
      });
    } catch (error) {
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
    }
  });

  // DELETE /api/items/:id/save - 取消保存内容项
  app.delete("/:id/save", async (c) => {
    const id = c.req.param("id");

    const saved = await isItemSaved(db, id);
    if (!saved) {
      return c.json({ success: false, error: "Item not saved" }, 404);
    }

    await unsaveItem(db, id);
    return c.json({ success: true, data: { savedAt: null } });
  });

  return app;
}

describe("save API integration tests", () => {
  let db: Database;
  let app: Hono;
  let testItemId: string;

  beforeEach(() => {
    // 使用内存数据库
    db = createDb(":memory:");

    // 添加 UNIQUE 约束以支持幂等性测试（确保同一 item 只能保存一次）
    db.exec(`DROP TABLE IF EXISTS saved_items`);
    db.exec(`
      CREATE TABLE saved_items (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL UNIQUE,
        pack_id TEXT,
        saved_at TEXT NOT NULL
      )
    `);

    // 插入测试数据
    testItemId = "test-item-1";
    db.prepare(
      `INSERT INTO raw_items (id, source_id, title, url, fetched_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      testItemId,
      "test-source",
      "Test Item Title",
      "https://example.com/test",
      "2026-03-17T00:00:00Z",
      '{"sourceType": "rss", "packId": "test-pack"}'
    );

    // 创建测试 app，传入数据库实例
    app = createTestItemsRoute(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("POST /:id/save", () => {
    test("saves an existing item", async () => {
      const res = await app.request(`/${testItemId}/save`, { method: "POST" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.savedAt).toBeDefined();
      expect(body.data.already).toBeUndefined();
    });

    test("returns 404 for non-existent item", async () => {
      const res = await app.request("/non-existent/save", { method: "POST" });
      const body = await res.json();
      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Item not found");
    });

    test("is idempotent - saving twice returns success", async () => {
      // 第一次保存
      const res1 = await app.request(`/${testItemId}/save`, { method: "POST" });
      const body1 = await res1.json();
      expect(body1.success).toBe(true);
      expect(body1.data.already).toBeUndefined();

      // 第二次保存
      const res2 = await app.request(`/${testItemId}/save`, { method: "POST" });
      const body2 = await res2.json();
      expect(res2.status).toBe(200);
      expect(body2.success).toBe(true);
      expect(body2.data.already).toBe(true);
    });
  });

  describe("DELETE /:id/save", () => {
    test("unsaves a saved item", async () => {
      // 先保存
      await app.request(`/${testItemId}/save`, { method: "POST" });

      // 取消保存
      const res = await app.request(`/${testItemId}/save`, { method: "DELETE" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.savedAt).toBeNull();
    });

    test("returns 404 for unsaved item", async () => {
      const res = await app.request(`/${testItemId}/save`, { method: "DELETE" });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Item not saved");
    });
  });

  describe("GET /saved", () => {
    test("returns empty list when no items saved", async () => {
      const res = await app.request("/saved");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual([]);
      expect(body.data.meta.total).toBe(0);
    });

    test("returns saved items", async () => {
      // 保存项目
      await app.request(`/${testItemId}/save`, { method: "POST" });

      const res = await app.request("/saved");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].id).toBe(testItemId);
      expect(body.data.items[0].title).toBe("Test Item Title");
      expect(body.data.meta.total).toBe(1);
    });

    test("reflects unsaved items", async () => {
      // 保存后取消
      await app.request(`/${testItemId}/save`, { method: "POST" });
      await app.request(`/${testItemId}/save`, { method: "DELETE" });

      const res = await app.request("/saved");
      const body = await res.json();

      expect(body.data.items).toEqual([]);
      expect(body.data.meta.total).toBe(0);
    });
  });
});
