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
    "json-feed": (source, _options) => collectJsonFeedSource(source),
    rss: (source, _options) => collectRssSource(source),
    website: (source, _options) => collectWebsiteSource(source),
    x: (source, _options) => collectXBirdSource(source),
    techurls: (source, _options) => collectTechurlsSource(source),
    zeli: (source, _options) => collectZeliSource(source),
    newsnow: (source, _options) => collectNewsnowSource(source),
    clawfeed: (source, _options) => collectClawfeedSource(source),
    attentionvc: (source, _options) => collectAttentionvcSource(source),
  };
}
