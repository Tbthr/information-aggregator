import { collectXBirdSource } from "../../../src/adapters/x-bird";
import { archiveTweetsAsContent } from "../../../src/archive/upsert-content-prisma";
import { createAiClient } from "../../../src/ai/providers";
import { prisma } from "../../../lib/prisma";
import { createLogger } from "../../../src/utils/logger";

const logger = createLogger("cron-collect-x");

export interface CollectXOptions {
  tabFilter: string[];
  label: string;
  skipAiEnrich?: boolean;
}

export async function runCollectXCron(options: CollectXOptions): Promise<void> {
  const { tabFilter, label, skipAiEnrich } = options;

  const configs = await prisma.xPageConfig.findMany({
    where: { enabled: true, tab: { in: tabFilter } },
  });

  if (configs.length === 0) {
    logger.info(`[${label}] No enabled configs for tabs: ${tabFilter.join(", ")}`);
    return;
  }

  // 认证直接从 env 读取
  const authToken = process.env.X_AUTH_TOKEN;
  const ct0 = process.env.X_CT0;

  if (!authToken || !ct0) {
    logger.warn(`[${label}] X_AUTH_TOKEN or X_CT0 not set, bird CLI may fail`);
  }

  const aiClient = skipAiEnrich ? null : createAiClient();
  let totalCollected = 0;
  let totalNew = 0;
  const allNewContentIds: string[] = [];

  for (const config of configs) {
    try {
      let sources: Array<{ type: string; id: string; url: string; configJson: string }> = [];

      if (config.tab === "lists" && config.listsJson) {
        const lists: Array<{ listId: string; name?: string }> = JSON.parse(config.listsJson);
        sources = lists.map((list) => ({
          type: "x-list",
          id: `x-list-${list.listId}`,
          url: `https://x.com/i/lists/${list.listId}`,
          configJson: JSON.stringify({
            birdMode: "list",
            listId: list.listId,
            count: config.count,
            fetchAll: config.fetchAll,
            maxPages: config.maxPages,
            authToken,
            ct0,
          }),
        }));
      } else {
        sources = [{
          type: `x-${config.birdMode}`,
          id: `x-${config.tab}`,
          url: "https://x.com",
          configJson: JSON.stringify({
            birdMode: config.birdMode,
            count: config.count,
            fetchAll: config.fetchAll,
            maxPages: config.maxPages,
            authToken,
            ct0,
          }),
        }];
      }

      for (const source of sources) {
        try {
          const rawItems = await collectXBirdSource(source as never);
          const result = await archiveTweetsAsContent(rawItems, config.tab);
          totalCollected += result.totalCount;
          totalNew += result.newCount;
          allNewContentIds.push(...result.newContentIds);
          logger.info(`[${label}/${config.tab}] Collected ${result.totalCount}, new ${result.newCount}`);
        } catch (err) {
          logger.error(`[${label}/${config.tab}] Collection failed:`, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    } catch (err) {
      logger.error(`[${label}/${config.tab}] Tab processing failed:`, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Tweet enrichment is temporarily disabled - requires refactoring to Content model
  // TODO: Re-enable tweet enrichment with Content-based approach

  logger.info(`[${label}] Total: collected ${totalCollected}, new ${totalNew}`);
}
