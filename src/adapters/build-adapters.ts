import { collectJsonFeedSource } from "./json-feed";
import { collectRssSource } from "./rss";
import { collectXBirdSource } from "./x-bird";
import { collectZeliSource } from "./zeli";
import { collectAttentionvcSource } from "./attentionvc";
import { collectGitHubTrendingSource } from "./github-trending";
import type { AdapterFn } from "../types/index";

/**
 * 构建适配器映射
 */
export function buildAdapters(): Record<string, AdapterFn> {
  return {
    "json-feed": (source, options) => collectJsonFeedSource(source, options),
    rss: (source, options) => collectRssSource(source, options),
    x: (source, options) => collectXBirdSource(source, options),
    zeli: (source, options) => collectZeliSource(source, options),
    attentionvc: (source, options) => collectAttentionvcSource(source, options),
    "github-trending": (source, options) => collectGitHubTrendingSource(source, options),
  };
}
