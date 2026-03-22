import { collectGitHubTrendingSource } from "./github-trending";
import { collectJsonFeedSource } from "./json-feed";
import { collectRssSource } from "./rss";
import type { AdapterFn } from "../types/index";

/**
 * 构建适配器映射
 */
export function buildAdapters(): Record<string, AdapterFn> {
  return {
    "github-trending": (source) => collectGitHubTrendingSource(source),
    "json-feed": (source) => collectJsonFeedSource(source),
    rss: (source) => collectRssSource(source),
  };
}
