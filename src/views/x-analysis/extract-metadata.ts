/**
 * Metadata 提取函数
 * 从 RawItem 的 metadataJson 中提取各种字段
 */

import type { RawItemMetadata } from "../../types/index";
import { parseRawItemMetadata } from "../../utils/metadata";
import type { XAnalysisMedia, XAnalysisArticle, XAnalysisQuote, XAnalysisThreadItem } from "./types";

/**
 * 从 metadataJson 中提取 engagement 数据
 */
export function extractEngagement(metadataJson: string | undefined): {
  likes: number;
  retweets: number;
  replies: number;
} | undefined {
  const metadata = parseRawItemMetadata(metadataJson);
  if (!metadata?.engagement) return undefined;

  const eng = metadata.engagement;
  const score = eng.score ?? 0;
  const reactions = eng.reactions ?? 0;
  const comments = eng.comments ?? 0;

  if (score === 0 && reactions === 0 && comments === 0) return undefined;

  return {
    likes: score,
    retweets: reactions,
    replies: comments,
  };
}

/**
 * 从 metadataJson 中提取 media 数据
 */
export function extractMedia(metadataJson: string | undefined): XAnalysisMedia[] | undefined {
  const metadata = parseRawItemMetadata(metadataJson);
  const media = metadata?.media;
  if (!media || media.length === 0) return undefined;

  return media
    .filter((m) => typeof m.url === "string")
    .map((m) => ({
      type: m.type ?? "photo",
      url: m.url,
      previewUrl: m.previewUrl,
    }));
}

/**
 * 从 metadataJson 中提取 article 数据
 */
export function extractArticle(metadataJson: string | undefined): XAnalysisArticle | undefined {
  const metadata = parseRawItemMetadata(metadataJson);
  const article = metadata?.article;
  if (!article?.title || !article?.url) return undefined;

  return {
    title: article.title,
    url: article.url,
    previewText: article.previewText,
  };
}

/**
 * 从 metadataJson 中提取 quote 数据
 */
export function extractQuote(metadataJson: string | undefined): XAnalysisQuote | undefined {
  const metadata = parseRawItemMetadata(metadataJson);
  const quote = metadata?.quote;
  if (!quote) return undefined;

  return {
    id: quote.id,
    text: quote.text,
    author: quote.author,
    url: quote.url,
  };
}

/**
 * 从 metadataJson 中提取 thread 数据
 */
export function extractThread(metadataJson: string | undefined): XAnalysisThreadItem[] | undefined {
  const metadata = parseRawItemMetadata(metadataJson);
  const thread = metadata?.thread;
  if (!thread || thread.length === 0) return undefined;

  return thread.map((t) => ({
    id: t.id,
    text: t.text,
    author: t.author,
  }));
}

/**
 * 从 RawItem 提取作者信息
 */
export function extractAuthor(item: {
  author?: string;
  sourceName?: string;
}): {
  author?: string;
  authorUrl?: string;
} {
  const author = item.author ?? item.sourceName;
  const authorUrl = author ? `https://x.com/${author}` : undefined;
  return { author, authorUrl };
}
