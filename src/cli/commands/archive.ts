import { createDb } from "../../db/client";
import { recordSourceSuccessWithMetrics, recordSourceFailure } from "../../db/queries/source-health";
import { syncPacksToDb } from "../../db/queries/source-packs";
import { upsertSource } from "../../db/queries/sources";
import { loadAllPacks } from "../../config/load-pack";
import { generateSourceId } from "../../config/source-id";
import { resolveSelection } from "../../query/resolve-selection";
import { collectSources, type CollectDependencies } from "../../pipeline/collect";
import { archiveRawItems } from "../../archive/upsert";
import { registerAdapterFamilies, type AdapterFamily } from "../../adapters/registry";
import { collectGitHubTrendingSource } from "../../adapters/github-trending";
import { collectJsonFeedSource } from "../../adapters/json-feed";
import { collectRssSource } from "../../adapters/rss";
import { collectXBirdSource } from "../../adapters/x-bird";
import { loadAllAuthConfigs } from "../../config/load-auth";

// 定义适配器家族
const ADAPTER_FAMILIES: AdapterFamily[] = [
  {
    names: ["x-bookmarks", "x-home", "x-likes", "x-list"],
    collect: collectXBirdSource,
    authKey: "x-family",
  },
];

function buildAdapters(): CollectDependencies["adapters"] {
  const authConfigs = loadAllAuthConfigs("config/auth");
  const familyAdapters = registerAdapterFamilies(ADAPTER_FAMILIES, authConfigs);

  return {
    "github-trending": (source) => collectGitHubTrendingSource(source),
    "json-feed": (source) => collectJsonFeedSource(source),
    rss: (source) => collectRssSource(source),
    ...familyAdapters,
  };
}

export interface ArchiveOptions {
  dbPath?: string;
  concurrency?: number;
  packDir?: string;
}

/**
 * archive collect 命令：抓取数据源并归档到数据库
 */
export async function archiveCollectCommand(
  packIds: string[],
  options: ArchiveOptions = {},
): Promise<void> {
  const dbPath = options.dbPath || "data/archive.db";
  const packDir = options.packDir || "config/packs";

  console.log(`Opening database: ${dbPath}`);
  const db = createDb(dbPath);

  console.log(`Loading packs from: ${packDir}`);
  const packs = await loadAllPacks(packDir);
  syncPacksToDb(db, packs);
  for (const pack of packs) {
    for (const source of pack.sources) {
      upsertSource(db, {
        id: generateSourceId(source.url),
        type: source.type,
        enabled: source.enabled !== false,
        url: source.url,
        configJson: source.configJson ?? "{}",
        policy: source.policy,
      });
    }
  }

  // 解析选择
  const selection = resolveSelection(
    {
      packIds: packIds.length > 0 ? packIds : packs.map((p) => p.id),
      viewId: "json",
      window: "all",
    },
    packs,
  );

  console.log(`Collecting from ${selection.sources.length} sources...`);

  // 构建依赖
  const dependencies: CollectDependencies = {
    adapters: buildAdapters(),
    concurrency: options.concurrency ?? 3,
    onSourceEvent: (event) => {
      const status =
        event.status === "success"
          ? "✓"
          : event.status === "zero-items"
            ? "○"
            : "✗";
      const count = event.itemCount ?? (event.status === "zero-items" ? 0 : "?");
      console.log(`  ${status} ${event.sourceId}: ${count} items`);
    },
  };

  const startTime = Date.now();

  // 抓取
  const items = await collectSources(selection.sources, dependencies);
  console.log(`\nCollected ${items.length} items in ${Date.now() - startTime}ms`);

  // 归档
  const now = new Date().toISOString();
  const result = archiveRawItems(db, items, now);

  console.log(`Archived: ${result.newCount} new, ${result.updateCount} updated`);

  // 更新数据源健康状态
  for (const source of selection.sources) {
    const sourceItems = items.filter((i) => i.sourceId === source.id);
    if (sourceItems.length > 0) {
      recordSourceSuccessWithMetrics(db, source.id, {
        fetchedAt: now,
        itemCount: sourceItems.length,
      });
    }
  }

  db.close();
}

/**
 * archive stats 命令：显示归档统计
 */
export async function archiveStatsCommand(options: ArchiveOptions = {}): Promise<void> {
  const dbPath = options.dbPath || "data/archive.db";
  const db = createDb(dbPath);

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

  console.log("Archive Statistics:");
  console.log(`  Total items: ${stats?.total ?? 0}`);
  console.log(`  Oldest item: ${stats?.oldest ?? "N/A"}`);
  console.log(`  Newest item: ${stats?.newest ?? "N/A"}`);

  // 按数据源统计
  const sourceStats = db
    .prepare(
      `SELECT source_id, COUNT(*) as count
       FROM raw_items
       GROUP BY source_id
       ORDER BY count DESC`,
    )
    .all() as Record<string, unknown>[];

  console.log("\nBy Source:");
  for (const row of sourceStats) {
    console.log(`  ${row.source_id}: ${row.count}`);
  }

  db.close();
}
