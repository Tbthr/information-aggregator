import { collectJsonFeedSource } from "./json-feed";
import { collectRssSource } from "./rss";
import { collectWebsiteSource } from "./website";
import { collectXBirdSource } from "./x-bird";
import type { AdapterFn } from "../types/index";

/**
 * 构建适配器映射
 * Note: github-trending is intentionally excluded - unsupported source type
 */
export function buildAdapters(): Record<string, AdapterFn> {
  return {
    "json-feed": (source) => collectJsonFeedSource(source),
    rss: (source) => collectRssSource(source),
    website: (source) => collectWebsiteSource(source),
    x: (source) => collectXBirdSource(source),
  };
}
