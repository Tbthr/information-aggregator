import { loadAllAuthConfigs } from "../config/load-auth";
import { registerAdapterFamilies, type AdapterFamily } from "./registry";
import { collectGitHubTrendingSource } from "./github-trending";
import { collectJsonFeedSource } from "./json-feed";
import { collectRssSource } from "./rss";
import { collectXBirdSource } from "./x-bird";
import type { AdapterFn } from "../types/index";

const ADAPTER_FAMILIES: AdapterFamily[] = [
  {
    names: ["x-bookmarks", "x-home", "x-likes", "x-list"],
    collect: collectXBirdSource,
    authKey: "x-family",
  },
];

/**
 * 构建适配器映射（异步加载 auth 配置）
 */
export async function buildAdapters(): Promise<Record<string, AdapterFn>> {
  const authConfigs = await loadAllAuthConfigs("config/auth");
  const familyAdapters = registerAdapterFamilies(ADAPTER_FAMILIES, authConfigs);

  return {
    "github-trending": (source) => collectGitHubTrendingSource(source),
    "json-feed": (source) => collectJsonFeedSource(source),
    rss: (source) => collectRssSource(source),
    ...familyAdapters,
  };
}
