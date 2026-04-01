import { collectJsonFeedSource } from "./json-feed";
import { collectRssSource } from "./rss";
import { collectWebsiteSource } from "./website";
import { collectXBirdSource } from "./x-bird";
import { collectTechurlsSource } from "./techurls";
import { collectZeliSource } from "./zeli";
import { collectNewsnowSource } from "./newsnow";
import { collectClawfeedSource } from "./clawfeed";
import { collectAttentionvcSource } from "./attentionvc";
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
    techurls: (source) => collectTechurlsSource(source),
    zeli: (source) => collectZeliSource(source),
    newsnow: (source) => collectNewsnowSource(source),
    clawfeed: (source) => collectClawfeedSource(source),
    attentionvc: (source) => collectAttentionvcSource(source),
  };
}
