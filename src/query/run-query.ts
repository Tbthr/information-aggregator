import type { AiClient } from "../ai/client";
import { buildCandidateQualityPrompt } from "../ai/prompts";
import { collectCustomApiSource } from "../adapters/custom-api";
import { collectDigestFeedSource } from "../adapters/digest-feed";
import { collectGitHubTrendingSource } from "../adapters/github-trending";
import { collectHnSource } from "../adapters/hn";
import { collectJsonFeedSource } from "../adapters/json-feed-collect";
import { collectOpmlRssSource } from "../adapters/opml-rss";
import { collectRedditSource } from "../adapters/reddit";
import { collectRssSource } from "../adapters/rss";
import { collectWebsiteSource } from "../adapters/website";
import { collectXBirdSource } from "../adapters/x-bird";
import { loadAllPacks } from "../config/load-pack";
import { buildClusters } from "../pipeline/cluster";
import { collectSources, type CollectDependencies } from "../pipeline/collect";
import { dedupeExact } from "../pipeline/dedupe-exact";
import { dedupeNear } from "../pipeline/dedupe-near";
import { enrichCandidates } from "../pipeline/enrich";
import { normalizeItems } from "../pipeline/normalize";
import { rankCandidates } from "../pipeline/rank";
import { scoreTopicMatch } from "../pipeline/topic-match";
import { parseRawItemMetadata, type Cluster, type NormalizedItem, type ParsedRunArgs, type RankedCandidate, type RawItem, type SourcePack, type TopicRule } from "../types/index";
import { resolveSelection, type ResolvedSelection, type ResolvedSource } from "./resolve-selection";

export interface RunQueryDependencies {
  aiClient?: AiClient | null;
  loadPacks?: () => Promise<SourcePack[]> | SourcePack[];
  collectSources?: (sources: ResolvedSource[], dependencies: CollectDependencies) => Promise<RawItem[]>;
  buildClusters?: typeof buildClusters;
  now?: () => string;
}

export interface QueryResult {
  args: ParsedRunArgs;
  selection: ResolvedSelection;
  items: RawItem[];
  normalizedItems: NormalizedItem[];
  rankedItems: RankedCandidate[];
  clusters: Cluster[];
  warnings: string[];
}

function buildTopicRule(keywords: string[]): TopicRule {
  return {
    includeKeywords: keywords.map((keyword) => keyword.toLowerCase()),
  };
}

function buildDefaultCollectDependencies(): CollectDependencies {
  return {
    adapters: {
      custom_api: (source) => collectCustomApiSource(source),
      digest_feed: (source) => collectDigestFeedSource(source),
      github_trending: (source) => collectGitHubTrendingSource(source),
      hn: (source) => collectHnSource(source),
      reddit: (source) => collectRedditSource(source),
      "json-feed": (source) => collectJsonFeedSource(source),
      opml_rss: (source) => collectOpmlRssSource(source),
      rss: (source) => collectRssSource(source),
      website: (source) => collectWebsiteSource(source),
      x_bookmarks: (source) => collectXBirdSource(source),
      x_home: (source) => collectXBirdSource(source),
      x_likes: (source) => collectXBirdSource(source),
      x_list: (source) => collectXBirdSource(source),
      x_multi: (source) => collectXBirdSource(source),
    },
  };
}

function resolveItemTimestamp(item: RawItem): number | null {
  const timestamp = item.publishedAt ?? item.fetchedAt;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveWindowRange(window: string, nowIso: string): { since?: number; until?: number } {
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    return {};
  }

  if (window === "all") {
    return { until: nowMs };
  }

  const match = window.match(/^(\d+)([hd])$/);
  if (!match) {
    return {};
  }

  const value = Number(match[1]);
  const unit = match[2];
  const deltaMs = unit === "h" ? value * 60 * 60 * 1000 : value * 24 * 60 * 60 * 1000;
  return {
    since: nowMs - deltaMs,
    until: nowMs,
  };
}

function filterItemsToRange(items: RawItem[], window: string, nowIso: string): RawItem[] {
  const windowRange = resolveWindowRange(window, nowIso);
  const { since, until } = windowRange;

  return items.filter((item) => {
    const timestamp = resolveItemTimestamp(item);
    if (timestamp === null) {
      return false;
    }
    if (since !== undefined && timestamp < since) {
      return false;
    }
    if (until !== undefined && timestamp > until) {
      return false;
    }
    return true;
  });
}

function toCandidates(items: NormalizedItem[], topicRule: TopicRule): RankedCandidate[] {
  return items.map((item) => {
    const metadata = parseRawItemMetadata(item.metadataJson);
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      sourceId: item.sourceId,
      sourceName: item.sourceId ?? "Unknown",
      normalizedTitle: item.normalizedTitle,
      normalizedText: item.normalizedText,
      canonicalUrl: item.canonicalUrl,
      linkedCanonicalUrl: item.linkedCanonicalUrl,
      relationshipToCanonical: item.relationshipToCanonical,
      isDiscussionSource: item.isDiscussionSource,
      processedAt: item.processedAt,
      contentType: item.contentType ?? metadata?.contentType,
      sourceType: item.sourceType ?? metadata?.sourceType,
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: item.engagementScore ?? 0,
      topicMatchScore: scoreTopicMatch(item, topicRule),
      contentQualityAi: 0,
    };
  });
}

export async function runQuery(args: ParsedRunArgs, dependencies: RunQueryDependencies = {}): Promise<QueryResult> {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const collectImpl = dependencies.collectSources ?? collectSources;
  const buildClustersImpl = dependencies.buildClusters ?? buildClusters;

  const packs = await Promise.resolve(
    dependencies.loadPacks?.() ?? loadAllPacks("config/packs")
  );

  const selection = resolveSelection(args, packs);
  const topicRule = buildTopicRule(selection.keywords);
  const collectedItems = await collectImpl(selection.sources, buildDefaultCollectDependencies());
  const items = filterItemsToRange(collectedItems, selection.window, now());
  const normalizedItems = normalizeItems(items);
  const exact = dedupeExact(normalizedItems.filter((item) => item.exactDedupKey) as Array<NormalizedItem & { exactDedupKey: string }>);
  const near = dedupeNear(exact.filter((item) => item.processedAt) as Array<NormalizedItem & { processedAt: string }>);
  const rankedItems = rankCandidates(await enrichCandidates(toCandidates(near, topicRule), {
    limit: 5,
    scoreCandidate: dependencies.aiClient
      ? async (candidate) =>
        dependencies.aiClient?.scoreCandidate(
          buildCandidateQualityPrompt(candidate.title ?? candidate.normalizedTitle ?? candidate.id, candidate.normalizedText ?? ""),
        ) ?? 0
      : undefined,
  }));
  const clusters = buildClustersImpl(
    rankedItems.map((candidate) => ({
      id: candidate.id,
      normalizedTitle: candidate.normalizedTitle ?? candidate.title ?? candidate.id,
      finalScore: candidate.finalScore,
      url: candidate.url ?? candidate.canonicalUrl,
      summary: candidate.rationale,
    })),
    `query-${Date.now()}`,
  );

  return {
    args,
    selection,
    items,
    normalizedItems,
    rankedItems,
    clusters,
    warnings: [],
  };
}
