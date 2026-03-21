import { loadAuthConfigsFromDb } from "../config/load-auth";
import { registerAdapterFamilies, ADAPTER_FAMILIES } from "./registry";
import { collectGitHubTrendingSource } from "./github-trending";
import { collectJsonFeedSource } from "./json-feed";
import { collectRssSource } from "./rss";
import type { AdapterFn } from "../types/index";

/**
 * 构建适配器映射（从数据库加载 auth 配置）
 */
export async function buildAdapters(): Promise<Record<string, AdapterFn>> {
  const authConfigs = await loadAuthConfigsFromDb();
  const familyAdapters = registerAdapterFamilies(ADAPTER_FAMILIES, authConfigs);

  return {
    "github-trending": (source) => collectGitHubTrendingSource(source),
    "json-feed": (source) => collectJsonFeedSource(source),
    rss: (source) => collectRssSource(source),
    ...familyAdapters,
  };
}
