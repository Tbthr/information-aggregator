import { afterEach, describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";

const createDbMock = mock(() => {
  throw new Error("createDb mock not configured");
});

const loadAllPacksMock = mock(() => {
  throw new Error("loadAllPacks mock not configured");
});

mock.module("../../db/client", () => ({
  createDb: createDbMock,
}));

mock.module("../../config/load-pack", () => ({
  loadAllPacks: loadAllPacksMock,
}));

const { packsRoute } = await import("./packs");

describe("packs route", () => {
  afterEach(() => {
    createDbMock.mockReset();
    loadAllPacksMock.mockReset();
  });

  test("counts retained items with keepDecision and treats null judgment as kept", async () => {
    loadAllPacksMock.mockResolvedValue([
      {
        id: "test-pack",
        name: "Test Pack",
        sources: [
          {
            type: "rss",
            url: "https://example.com/feed.xml",
            enabled: true,
          },
        ],
        policy: { mode: "filter_then_assist" },
      },
    ]);

    const db = {
      prepare(sql: string) {
        if (sql.includes("SELECT COUNT(*) as count, MAX(fetched_at) as latest")) {
          return {
            get() {
              return { count: 3, latest: "2026-03-17T10:00:00.000Z" };
            },
          };
        }

        if (sql.includes("SELECT COUNT(DISTINCT ri.id) as count")) {
          return {
            get() {
              return { count: 2 };
            },
          };
        }

        if (sql.includes("GROUP BY sourceType")) {
          return {
            all() {
              return [{ sourceType: "rss", count: 3 }];
            },
          };
        }

        if (sql.includes("FROM raw_items") && sql.includes("LIMIT 20")) {
          return {
            all() {
              return [
                {
                  id: "item-1",
                  source_id: "test-pack::https://example.com/feed.xml",
                  title: "One",
                  url: "https://example.com/1",
                  fetched_at: "2026-03-17T10:00:00.000Z",
                  metadata_json: '{"sourceType":"rss","packId":"test-pack"}',
                },
              ];
            },
          };
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
      close() {},
    };

    (createDbMock as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(db);

    const app = new Hono().route("/packs", packsRoute);
    const res = await app.request("/packs/test-pack");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.stats.totalItems).toBe(3);
    expect(body.data.stats.retainedItems).toBe(2);
    expect(body.data.stats.retentionRate).toBeCloseTo(0.67, 2);
  });
});
