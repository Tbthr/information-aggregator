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
import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig, loadViewsConfig } from "../config/load";
import { buildClusters } from "../pipeline/cluster";
import { collectSources, type CollectDependencies } from "../pipeline/collect";
import { dedupeExact } from "../pipeline/dedupe-exact";
import { dedupeNear } from "../pipeline/dedupe-near";
import { enrichCandidates } from "../pipeline/enrich";
import { normalizeItems } from "../pipeline/normalize";
import { rankCandidates } from "../pipeline/rank";
import { scoreTopicMatch } from "../pipeline/topic-match";
import { parseRawItemMetadata, type Cluster, type NormalizedItem, type QueryViewDefinition, type RankedCandidate, type RawItem, type Source, type SourcePack, type TopicDefinition, type TopicProfile, type TopicRule } from "../types/index";
import { resolveSelection, type ResolvedSelection } from "./resolve-selection";
import type { QuerySpec } from "./spec";

export interface RunQueryDependencies {
  aiClient?: AiClient | null;
  loadSources?: () => Promise<Source[]> | Source[];
  loadProfiles?: () => Promise<TopicProfile[]> | TopicProfile[];
  loadTopics?: () => Promise<TopicDefinition[]> | TopicDefinition[];
  loadSourcePacks?: () => Promise<SourcePack[]> | SourcePack[];
  loadViews?: () => Promise<QueryViewDefinition[]> | QueryViewDefinition[];
  collectSources?: (sources: Source[], dependencies: CollectDependencies) => Promise<RawItem[]>;
  buildClusters?: typeof buildClusters;
  now?: () => string;
}

export interface QueryResult {
  query: QuerySpec;
  selection: ResolvedSelection;
  items: RawItem[];
  normalizedItems: NormalizedItem[];
  rankedItems: RankedCandidate[];
  clusters: Cluster[];
  warnings: string[];
}

async function loadDefaultSourcePacks(): Promise<SourcePack[]> {
  const [newsSites, blogPacks] = await Promise.all([
    loadSourcePacksConfig("config/packs/ai-news-sites.yaml"),
    loadSourcePacksConfig("config/packs/engineering-blogs-core.yaml"),
  ]);

  return [...newsSites, ...blogPacks];
}

function buildTopicRule(topics: TopicDefinition[], topicIds: string[]): TopicRule {
  const selectedTopics = topics.filter((topic) => topicIds.includes(topic.id));

  return {
    includeKeywords: selectedTopics.flatMap((topic) => topic.keywords).map((keyword) => keyword.toLowerCase()),
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

function resolveWindowRange(window: string | undefined, nowIso: string): { since?: number; until?: number } {
  const nowMs = Date.parse(nowIso);
  if (window === undefined || Number.isNaN(nowMs)) {
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

function filterItemsToRange(items: RawItem[], selection: ResolvedSelection, nowIso: string): RawItem[] {
  const explicitSince = selection.since ? Date.parse(selection.since) : undefined;
  const explicitUntil = selection.until ? Date.parse(selection.until) : undefined;
  const windowRange = resolveWindowRange(selection.window, nowIso);
  const since = explicitSince ?? windowRange.since;
  const until = explicitUntil ?? windowRange.until;

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

export async function runQuery(query: QuerySpec, dependencies: RunQueryDependencies = {}): Promise<QueryResult> {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const collectImpl = dependencies.collectSources ?? collectSources;
  const buildClustersImpl = dependencies.buildClusters ?? buildClusters;

  const [sources, profiles, topics, sourcePacks, views] = await Promise.all([
    Promise.resolve(dependencies.loadSources?.() ?? loadSourcesConfig("config/sources.example.yaml")),
    Promise.resolve(dependencies.loadProfiles?.() ?? loadProfilesConfig("config/profiles.example.yaml")),
    Promise.resolve(dependencies.loadTopics?.() ?? loadTopicsConfig("config/topics.example.yaml")),
    Promise.resolve(dependencies.loadSourcePacks?.() ?? loadDefaultSourcePacks()),
    Promise.resolve(dependencies.loadViews?.() ?? loadViewsConfig("config/views.example.yaml")),
  ]);

  const selection = resolveSelection({ query, profiles, sourcePacks, sources, views });
  const topicRule = buildTopicRule(topics, selection.topicIds);
  const collectedItems = await collectImpl(selection.sources, buildDefaultCollectDependencies());
  const items = filterItemsToRange(collectedItems, selection, now());
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
    query,
    selection,
    items,
    normalizedItems,
    rankedItems,
    clusters,
    warnings: [],
  };
}
