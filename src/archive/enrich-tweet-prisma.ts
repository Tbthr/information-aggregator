/**
 * Tweet AI 增强模块（Prisma 版本）
 * 对 Tweet 进行 AI 评分、摘要、要点提取和标签生成
 */

import { prisma } from "../../lib/prisma";
import type { AiClient } from "../ai/types";
import { createLogger } from "../utils/logger";

const logger = createLogger("archive:enrich-tweet-prisma");

/**
 * 构建推文的完整内容上下文用于 AI 增强
 * - text 是纯 URL → 返回 articleJson 中的 title + previewText
 * - text 是正常文本 → 返回 text + 引用推文全文 + 引用文章摘要
 */
function buildEnrichmentContent(tweet: {
  text: string;
  articleJson: string | null;
  quotedTweetJson: string | null;
}): string {
  // text 是纯 URL 的情况（如用户只发了一个链接）
  if (/^https?:\/\/\S+$/.test(tweet.text.trim())) {
    if (tweet.articleJson) {
      try {
        const article = JSON.parse(tweet.articleJson) as { title?: string; previewText?: string };
        const parts: string[] = [];
        if (article.title) parts.push(article.title);
        if (article.previewText) parts.push(article.previewText);
        return parts.join("\n\n") || tweet.text;
      } catch {
        return tweet.text;
      }
    }
    return tweet.text;
  }

  // 正常文本：附加引用推文和引用文章内容
  const parts: string[] = [tweet.text];

  if (tweet.quotedTweetJson) {
    try {
      const quoted = JSON.parse(tweet.quotedTweetJson) as { text?: string; article?: { title?: string; previewText?: string } };
      if (quoted.text) {
        parts.push(`[引用推文]\n${quoted.text}`);
      }
      if (quoted.article?.title || quoted.article?.previewText) {
        const articleParts: string[] = [];
        if (quoted.article.title) articleParts.push(quoted.article.title);
        if (quoted.article.previewText) articleParts.push(quoted.article.previewText);
        if (articleParts.length > 0) {
          parts.push(`[引用文章]\n${articleParts.join("\n")}`);
        }
      }
    } catch {
      // JSON 解析失败，忽略
    }
  }

  return parts.join("\n\n");
}

export interface TweetEnrichResult {
  successCount: number;
  failCount: number;
  totalCount: number;
}

export interface TweetEnrichConfig {
  scoring: boolean;
  keyPoints: boolean;
  tagging: boolean;
  filterPrompt?: string;
}

/**
 * 对单条 Tweet 执行 AI 增强
 */
async function aiEnrichTweet(
  tweet: { id: string; text: string; url: string; authorHandle: string; articleJson: string | null; quotedTweetJson: string | null; expandedUrl: string | null },
  aiClient: AiClient,
  config: TweetEnrichConfig,
): Promise<{
  summary?: string;
  bullets?: string[];
  categories?: string[];
  score?: number;
} | null> {
  const title = `@${tweet.authorHandle}`;
  const content = buildEnrichmentContent(tweet);

  try {
    const tasks: Promise<unknown>[] = [];

    if (config.scoring) {
      tasks.push(
        aiClient.scoreWithContent(title, content, tweet.url).catch(() => null),
      );
    } else {
      tasks.push(Promise.resolve(null));
    }

    if (config.keyPoints) {
      tasks.push(
        aiClient
          .summarizeContent(title, content, 150)
          .catch(() => null),
      );
      tasks.push(
        aiClient
          .extractKeyPoints(title, content, 5)
          .catch(() => null),
      );
    } else {
      tasks.push(Promise.resolve(null));
      tasks.push(Promise.resolve(null));
    }

    if (config.tagging) {
      tasks.push(
        aiClient.generateTags(title, content, 3).catch(() => null),
      );
    } else {
      tasks.push(Promise.resolve(null));
    }

    const [scoreResult, summaryResult, keyPointsResult, tagsResult] =
      (await Promise.all(tasks)) as [
        number | null,
        string | null,
        string[] | null,
        string[] | null,
      ];

    return {
      score: scoreResult ?? undefined,
      summary: summaryResult ?? undefined,
      bullets: keyPointsResult ?? [],
      categories: tagsResult ?? [],
    };
  } catch (error) {
    logger.error("AI enrichment failed for tweet", {
      tweetId: tweet.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 批量增强 Tweets
 */
export async function enrichTweets(
  tweetIds: string[],
  aiClient: AiClient,
  config: TweetEnrichConfig,
): Promise<TweetEnrichResult> {
  if (tweetIds.length === 0) {
    return { successCount: 0, failCount: 0, totalCount: 0 };
  }

  // 获取 Tweet 详情
  const tweets = await prisma.tweet.findMany({
    where: { id: { in: tweetIds } },
    select: { id: true, text: true, url: true, authorHandle: true, articleJson: true, quotedTweetJson: true, expandedUrl: true },
  });

  if (tweets.length === 0) {
    return { successCount: 0, failCount: 0, totalCount: tweetIds.length };
  }

  logger.info("Starting tweet enrichment", {
    total: tweetIds.length,
    found: tweets.length,
    config: {
      scoring: config.scoring,
      keyPoints: config.keyPoints,
      tagging: config.tagging,
    },
  });

  let successCount = 0;
  let failCount = 0;

  for (const tweet of tweets) {
    try {
      const result = await aiEnrichTweet(tweet, aiClient, config);

      // 构建更新数据，仅包含有值变化的字段
      const updateData: Record<string, unknown> = {};
      let hasUpdate = false;

      if (result) {
        if (result.score !== undefined) {
          updateData.score = result.score;
          hasUpdate = true;
        }
        if (result.summary !== undefined) {
          updateData.summary = result.summary;
          hasUpdate = true;
        }
        if (result.bullets !== undefined) {
          updateData.bullets = result.bullets;
          hasUpdate = true;
        }
        if (result.categories !== undefined) {
          updateData.categories = result.categories;
          hasUpdate = true;
        }
      }

      if (hasUpdate) {
        await prisma.tweet.update({
          where: { id: tweet.id },
          data: updateData,
        });
        successCount++;
      } else {
        // 没有任何更新数据，视为失败
        failCount++;
      }
    } catch (error) {
      logger.error("Failed to update tweet", {
        tweetId: tweet.id,
        error: error instanceof Error ? error.message : String(error),
      });
      failCount++;
    }
  }

  logger.info("Tweet enrichment completed", {
    total: tweetIds.length,
    success: successCount,
    failed: failCount,
  });

  return {
    successCount,
    failCount,
    totalCount: tweetIds.length,
  };
}
