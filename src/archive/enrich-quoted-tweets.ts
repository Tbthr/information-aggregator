/**
 * 引用推文数据增强模块
 * 使用 bird read 获取被引用推文的完整数据（含 article、authorName 等）
 */

import { prisma } from "../../lib/prisma";
import { spawn } from "node:child_process";
import { createLogger } from "../utils/logger";

const logger = createLogger("archive:enrich-quoted-tweets");

export interface EnrichQuotedTweetsResult {
  enriched: number;
  skipped: number;
  failed: number;
}

interface BirdReadQuotedTweet {
  id: string;
  text?: string;
  createdAt?: string;
  replyCount?: number;
  retweetCount?: number;
  likeCount?: number;
  author?: { username?: string; name?: string };
  authorId?: string;
  article?: { title?: string; url?: string; previewText?: string };
  media?: unknown;
}

interface ExistingQuotedTweet {
  id?: string;
  text?: string;
  authorHandle?: string;
  authorName?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  article?: { title?: string; url?: string; previewText?: string };
}

/**
 * 使用 bird read 获取单条推文的完整数据
 */
async function fetchTweetById(
  tweetId: string,
  authTokenEnv?: string | null,
  ct0Env?: string | null,
): Promise<BirdReadQuotedTweet | null> {
  const args: string[] = ["bird", "--plain"];

  if (authTokenEnv) {
    const authToken = process.env[authTokenEnv];
    if (authToken) {
      args.push("--auth-token", authToken);
    }
  }
  if (ct0Env) {
    const ct0 = process.env[ct0Env];
    if (ct0) {
      args.push("--ct0", ct0);
    }
  }

  args.push("read", tweetId, "--json");

  return new Promise((resolve) => {
    const proc = spawn(args[0], args.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const timeout = setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 15_000);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve(null);
        return;
      }

      try {
        const output = Buffer.concat(stdoutChunks).toString();
        const data = JSON.parse(output) as BirdReadQuotedTweet;
        resolve(data);
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * 并发控制辅助函数
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index++;
      await fn(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

/**
 * 增强引用推文数据
 *
 * 对包含 quotedTweet 但缺少 article 字段的推文，
 * 使用 bird read 获取被引用推文的完整数据
 */
export async function enrichQuotedTweets(
  tweetIds: string[],
  config?: { authTokenEnv?: string | null; ct0Env?: string | null; concurrency?: number },
): Promise<EnrichQuotedTweetsResult> {
  if (tweetIds.length === 0) {
    return { enriched: 0, skipped: 0, failed: 0 };
  }

  const concurrency = config?.concurrency ?? 3;

  // 查找需要增强的推文：有 quotedTweetJson 且 quotedTweet 中没有 article 字段
  const tweets = await prisma.tweet.findMany({
    where: { id: { in: tweetIds } },
    select: { id: true, quotedTweetJson: true },
  });

  const toEnrich: Array<{ dbId: string; quotedTweetId: string; existingQuoted: ExistingQuotedTweet }> = [];

  for (const tweet of tweets) {
    if (!tweet.quotedTweetJson) continue;

    try {
      const quoted = JSON.parse(tweet.quotedTweetJson) as ExistingQuotedTweet;
      if (quoted.id && !quoted.article) {
        toEnrich.push({
          dbId: tweet.id,
          quotedTweetId: quoted.id,
          existingQuoted: quoted,
        });
      }
    } catch {
      // JSON 解析失败，跳过
    }
  }

  if (toEnrich.length === 0) {
    logger.info("No quoted tweets need enrichment");
    return { enriched: 0, skipped: tweets.length, failed: 0 };
  }

  logger.info("Starting quoted tweet enrichment", {
    total: toEnrich.length,
    concurrency,
  });

  let enriched = 0;
  let failed = 0;

  await runWithConcurrency(toEnrich, concurrency, async (item) => {
    try {
      const fullTweet = await fetchTweetById(
        item.quotedTweetId,
        config?.authTokenEnv,
        config?.ct0Env,
      );

      if (!fullTweet) {
        failed++;
        return;
      }

      // 合并现有数据和新增数据
      const enrichedQuoted = {
        id: fullTweet.id || item.existingQuoted.id,
        text: fullTweet.text || item.existingQuoted.text || "",
        authorHandle: fullTweet.author?.username || item.existingQuoted.authorHandle || "",
        authorName: fullTweet.author?.name || item.existingQuoted.authorName,
        likeCount: fullTweet.likeCount ?? item.existingQuoted.likeCount ?? 0,
        replyCount: fullTweet.replyCount ?? item.existingQuoted.replyCount ?? 0,
        retweetCount: fullTweet.retweetCount ?? item.existingQuoted.retweetCount ?? 0,
        ...(fullTweet.article ? { article: fullTweet.article } : {}),
        ...(fullTweet.createdAt ? { createdAt: fullTweet.createdAt } : {}),
        ...(fullTweet.media ? { media: fullTweet.media } : {}),
      };

      await prisma.tweet.update({
        where: { id: item.dbId },
        data: { quotedTweetJson: JSON.stringify(enrichedQuoted) },
      });

      enriched++;
    } catch (err) {
      logger.error("Failed to enrich quoted tweet", {
        dbId: item.dbId,
        quotedTweetId: item.quotedTweetId,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  });

  const skipped = tweets.length - toEnrich.length;

  logger.info("Quoted tweet enrichment completed", {
    total: toEnrich.length,
    enriched,
    skipped,
    failed,
  });

  return { enriched, skipped, failed };
}
