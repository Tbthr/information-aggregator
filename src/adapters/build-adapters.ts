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
    "json-feed": (source, options) => collectJsonFeedSource(source, options),
    rss: (source, options) => collectRssSource(source, options),
    website: (source, options) => collectWebsiteSource(source, options),
    x: (source, options) => collectXBirdSource(source, options),
    techurls: (source, options) => collectTechurlsSource(source, options),
    zeli: (source, options) => collectZeliSource(source, options),
    newsnow: (source, options) => collectNewsnowSource(source, options),
    clawfeed: (source, options) => collectClawfeedSource(source, options),
    attentionvc: (source, options) => collectAttentionvcSource(source, options),
  };
}
