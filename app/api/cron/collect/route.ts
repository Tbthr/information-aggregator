import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib";
import { loadAllPacksFromDb } from "../../../../src/config/load-pack-prisma";
import { generateSourceId } from "../../../../src/config/source-id";
import { resolveSelection } from "../../../../src/query/resolve-selection";
import { collectSources, type CollectDependencies } from "../../../../src/pipeline/collect";
import {
  archiveRawItems,
  syncPacksToPrisma,
  upsertSourcesBatch,
  recordSourcesSuccessBatch,
  recordSourceFailure,
} from "../../../../src/archive/upsert-prisma";
import { getItemsToEnrich, enrichItems } from "../../../../src/archive/enrich-prisma";
import { createAiClient, loadSettings } from "../../../../src/ai/providers";
import { buildAdapters } from "../../../../src/adapters/build-adapters";
import { createLogger } from "../../../../src/utils/logger";

const logger = createLogger("cron:collect");

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  runAfterJob("collect", async () => {
    try {
      logger.info("Starting collect job");

      const packs = await loadAllPacksFromDb();

      // 同步 Packs
      const packRecords = packs.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        policyJson: p.policy ? JSON.stringify(p.policy) : undefined,
      }));
      await syncPacksToPrisma(packRecords);

      // 同步数据源
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

      // 解析选择
      const selection = resolveSelection(
        {
          packIds: packs.map((p) => p.id),
          viewId: "json",
          window: "all",
        },
        packs,
      );

      logger.info("Collecting from sources", { count: selection.sources.length });

      // 收集失败的数据源
      const failedSources: Array<{ sourceId: string; error: string }> = [];

      // 构建依赖
      const dependencies: CollectDependencies = {
        adapters: await buildAdapters(),
        concurrency: 3,
        onSourceEvent: (event) => {
          logger.info("Source event", {
            sourceId: event.sourceId,
            status: event.status,
            itemCount: event.itemCount,
          });
          if (event.status === "failure") {
            failedSources.push({
              sourceId: event.sourceId,
              error: event.error || "Unknown error",
            });
          }
        },
      };

      // 抓取
      const items = await collectSources(selection.sources, dependencies);
      logger.info("Collected items", { count: items.length });

      // 归档
      const now = new Date().toISOString();
      const result = await archiveRawItems(items, now);
      logger.info("Archived items", { newCount: result.newCount, updateCount: result.updateCount });

      // AI 增强
      if (result.newCount > 0) {
        const settings = await loadSettings();
        if (settings) {
          const aiClient = await createAiClient();
          if (aiClient) {
            const newItemIds = items.slice(0, result.newCount).map((i) => i.id);
            const enrichItemIds = await getItemsToEnrich("new", newItemIds);
            if (enrichItemIds.length > 0) {
              logger.info("Enriching items", { count: enrichItemIds.length });
              const enrichResult = await enrichItems(enrichItemIds, aiClient);
              logger.info("Enriched items", { success: enrichResult.successCount, failed: enrichResult.failCount });
            }
          }
        }
      }

      // 记录失败的数据源（先记录失败，避免被成功记录覆盖）
      const failedSourceIds = new Set(failedSources.map((s) => s.sourceId));
      if (failedSources.length > 0) {
        await Promise.allSettled(
          failedSources.map((s) => recordSourceFailure(s.sourceId, s.error))
        );
      }

      // 更新成功数据源的健康状态（排除已失败的源）
      const healthRecords = selection.sources
        .filter((source) => !failedSourceIds.has(source.id))
        .map((source) => {
          const sourceItems = items.filter((i) => i.sourceId === source.id);
          return { sourceId: source.id, fetchedAt: now, itemCount: sourceItems.length };
        })
        .filter((r) => r.itemCount > 0);
      await recordSourcesSuccessBatch(healthRecords);

      logger.info("Collect job completed");
    } catch (error) {
      logger.error("Collect job failed", { error: error instanceof Error ? error.message : String(error) });
    }
  });

  return NextResponse.json({ success: true, message: "Collect job started" }, { status: 202 });
}
