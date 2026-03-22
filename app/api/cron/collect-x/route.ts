import { NextResponse } from "next/server";
import { verifyCronRequest, unauthorizedResponse, runAfterJob } from "../_lib";
import { collectXBirdSource } from "../../../../src/adapters/x-bird";
import { archiveTweets } from "../../../../src/archive/upsert-tweet-prisma";
import { enrichTweets } from "../../../../src/archive/enrich-tweet-prisma";
import { enrichQuotedTweets } from "../../../../src/archive/enrich-quoted-tweets";
import { createAiClient } from "../../../../src/ai/providers";
import { prisma } from "../../../../lib/prisma";
import { createLogger } from "../../../../src/utils/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const logger = createLogger("cron-collect-x");

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  runAfterJob("collect-x", async () => {
    try {
      const configs = await prisma.xPageConfig.findMany({
        where: { enabled: true },
      });

      if (configs.length === 0) {
        logger.info("No enabled X configs found");
        return;
      }

      const aiClient = createAiClient();
      let totalCollected = 0;
      let totalNew = 0;
      const allNewTweetIds: string[] = [];

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
                authTokenEnv: config.authTokenEnv,
                ct0Env: config.ct0Env,
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
                authTokenEnv: config.authTokenEnv,
                ct0Env: config.ct0Env,
              }),
            }];
          }

          for (const source of sources) {
            try {
              const rawItems = await collectXBirdSource(source as never);
              const result = await archiveTweets(rawItems, config.tab);
              totalCollected += result.totalCount;
              totalNew += result.newCount;
              allNewTweetIds.push(...result.newTweetIds);
              logger.info(`[${config.tab}] Collected ${result.totalCount}, new ${result.newCount}`);
            } catch (err) {
              logger.error(`[${config.tab}] Collection failed:`, { error: err instanceof Error ? err.message : String(err) });
            }
          }
        } catch (err) {
          logger.error(`[${config.tab}] Tab processing failed:`, { error: err instanceof Error ? err.message : String(err) });
        }
      }

      if (allNewTweetIds.length > 0) {
        // 增强引用推文数据（获取被引用推文的 article 等完整信息）
        const authConfig = configs[0] ?? configs.find((c: { authTokenEnv?: string | null }) => c.authTokenEnv);
        if (authConfig) {
          const quotedResult = await enrichQuotedTweets(allNewTweetIds, {
            authTokenEnv: authConfig.authTokenEnv,
            ct0Env: authConfig.ct0Env,
          });
          logger.info(`Enriched ${quotedResult.enriched} quoted tweets (${quotedResult.skipped} skipped, ${quotedResult.failed} failed)`);
        }
      }

      if (aiClient && allNewTweetIds.length > 0) {
        const mainConfig = configs.find((c) => c.enrichEnabled);
        if (mainConfig) {
          const result = await enrichTweets(allNewTweetIds, aiClient, {
            scoring: mainConfig.enrichScoring,
            keyPoints: mainConfig.enrichKeyPoints,
            tagging: mainConfig.enrichTagging,
            filterPrompt: mainConfig.filterPrompt ?? undefined,
          });
          logger.info(`Enriched ${result.successCount}/${result.totalCount} tweets`);
        }
      }

      logger.info(`Total: collected ${totalCollected}, new ${totalNew}`);
    } catch (err) {
      logger.error("X cron job failed:", { error: err instanceof Error ? err.message : String(err) });
    }
  });

  return NextResponse.json({ success: true, message: "X collect job started" }, { status: 202 });
}
