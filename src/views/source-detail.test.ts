import { describe, expect, test } from "bun:test";
import { createDb } from "../db/client";
import { generateSourceId } from "../config/source-id";
import { buildSourceDetail } from "./source-detail";

describe("buildSourceDetail", () => {
  test("falls back to pack policy when source policy is missing", async () => {
    const db = createDb(":memory:");
    const sourceId = generateSourceId("https://example.com/feed.xml");

    db.exec(`
      INSERT INTO source_packs (id, name, source_ids_json, policy_json)
      VALUES (
        'test-pack',
        'Test Pack',
        '["${sourceId}"]',
        '{"mode":"assist_only","filterPrompt":"只做辅助"}'
      );

      INSERT INTO sources (id, type, enabled, url, config_json)
      VALUES (
        '${sourceId}',
        'rss',
        1,
        'https://example.com/feed.xml',
        '{}'
      );

      INSERT INTO raw_items (id, source_id, title, url, fetched_at, metadata_json)
      VALUES (
        'raw-1',
        '${sourceId}',
        'A title',
        'https://example.com/post',
        '2026-03-17T09:00:00.000Z',
        '{"sourceType":"rss","packId":"test-pack","sourceUrl":"https://example.com/feed.xml"}'
      );

      INSERT INTO normalized_items (id, raw_item_id, source_id, canonical_url, normalized_title, processed_at)
      VALUES (
        'norm-1',
        'raw-1',
        '${sourceId}',
        'https://example.com/post',
        'A title',
        '2026-03-17T09:00:00.000Z'
      );
    `);

    const view = await buildSourceDetail({
      db,
      sourceId,
      windowDays: 30,
    });

    expect(view).not.toBeNull();
    expect(view?.policy.mode).toBe("assist_only");
    expect(view?.policy.filterPrompt).toBe("只做辅助");
    expect(view?.policy.inheritedFrom).toBe("test-pack");
  });

  test("uses raw item metadata when source row is missing", async () => {
    const db = createDb(":memory:");
    const sourceId = generateSourceId("https://example.com/raw-only.xml");

    db.exec(`
      INSERT INTO raw_items (id, source_id, title, url, fetched_at, metadata_json)
      VALUES (
        'raw-only-1',
        '${sourceId}',
        'Raw only',
        'https://example.com/raw-only/post',
        '2026-03-17T09:00:00.000Z',
        '{"sourceType":"rss","packId":"raw-pack","sourceUrl":"https://example.com/raw-only.xml"}'
      );
    `);

    const view = await buildSourceDetail({
      db,
      sourceId,
      windowDays: 30,
    });

    expect(view).not.toBeNull();
    expect(view?.source.id).toBe(sourceId);
    expect(view?.source.type).toBe("rss");
    expect(view?.source.url).toBe("https://example.com/raw-only.xml");
    expect(view?.source.packId).toBe("raw-pack");
  });
});
