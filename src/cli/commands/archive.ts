import { loadAllPacks } from "../../config/load-pack";
import { generateSourceId } from "../../config/source-id";
import { resolveSelection } from "../../query/resolve-selection";
import { collectSources, type CollectDependencies } from "../../pipeline/collect";
import {
  archiveRawItems,
  syncPacksToPrisma,
  upsertSourcesBatch,
  recordSourcesSuccessBatch,
  getArchiveStats,
} from "../../archive/upsert-prisma";
import { getItemsToEnrich, enrichItems } from "../../archive/enrich-prisma";
import { createAiClient, loadSettings } from "../../ai/providers";
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
  concurrency?: number;
  packDir?: string;
  enrichMode?: "new" | "backfill" | "force";
}

/**
 * archive collect 命令：抓取数据源并归档到 Supabase
 */
export async function archiveCollectCommand(
  packIds: string[],
  options: ArchiveOptions = {},
): Promise<void> {
  const packDir = options.packDir || "config/packs";
  const enrichMode = options.enrichMode ?? "new";

  console.log(`Connecting to Supabase database...`);
  console.log(`Loading packs from: ${packDir}`);
  const packs = await loadAllPacks(packDir);

  // 同步 Packs
  const packRecords = packs.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    policyJson: p.policy ? JSON.stringify(p.policy) : undefined,
  }));
  await syncPacksToPrisma(packRecords);
  console.log(`Synced ${packs.length} packs`);

  // 同步数据源（批量）
  const allSources: Array<{
    id: string;
    type: string;
    name?: string;
    enabled: boolean;
    url?: string;
    configJson?: string;
    packId?: string;
  }> = [];

  for (const pack of packs) {
    for (const source of pack.sources) {
      allSources.push({
        id: generateSourceId(source.url),
        type: source.type,
        name: source.description,
        enabled: source.enabled !== false,
        url: source.url,
        configJson: source.configJson,
        packId: pack.id,
      });
    }
  }
  await upsertSourcesBatch(allSources);
  console.log(`Synced ${allSources.length} sources`);

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

  // 归档到 Supabase（基础字段）
  const now = new Date().toISOString();
  const result = await archiveRawItems(items, now);

  console.log(`Archived: ${result.newCount} new, ${result.updateCount} updated`);

  // AI 增强
  if (enrichMode !== "new" || result.newCount > 0) {
    console.log(`\nStarting AI enrichment (mode: ${enrichMode})...`);

    const settings = await loadSettings();
    if (!settings) {
      console.log("AI settings not configured, skipping enrichment");
    } else {
      const aiClient = await createAiClient();
      if (!aiClient) {
        console.log("Failed to create AI client, skipping enrichment");
      } else {
        // 确定需要增强的 Item
        const newItemIds = items.slice(0, result.newCount).map((i) => i.id);
        const enrichItemIds = await getItemsToEnrich(enrichMode, newItemIds);

        if (enrichItemIds.length > 0) {
          console.log(`Enriching ${enrichItemIds.length} items...`);
          const enrichResult = await enrichItems(enrichItemIds, aiClient);
          console.log(`Enriched: ${enrichResult.successCount} success, ${enrichResult.failCount} failed`);
        } else {
          console.log("No items to enrich");
        }
      }
    }
  }

  // 更新数据源健康状态（批量）
  const healthRecords = selection.sources
    .map((source) => {
      const sourceItems = items.filter((i) => i.sourceId === source.id);
      return {
        sourceId: source.id,
        fetchedAt: now,
        itemCount: sourceItems.length,
      };
    })
    .filter((r) => r.itemCount > 0);

  await recordSourcesSuccessBatch(healthRecords);

  console.log(`Done!`);
}

/**
 * archive stats 命令：显示 Supabase 归档统计
 */
export async function archiveStatsCommand(options: ArchiveOptions = {}): Promise<void> {
  console.log("Connecting to Supabase database...\n");

  const stats = await getArchiveStats();

  console.log("Archive Statistics:");
  console.log(`  Total items: ${stats.totalItems}`);
  console.log(`  Oldest item: ${stats.oldestItem ?? "N/A"}`);
  console.log(`  Newest item: ${stats.newestItem ?? "N/A"}`);

  console.log("\nBy Source:");
  for (const row of stats.bySource) {
    console.log(`  ${row.sourceId}: ${row.count}`);
  }
}
