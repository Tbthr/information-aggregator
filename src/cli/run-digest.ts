import { createDb } from "../db/client";
import { insertClusters } from "../db/queries/clusters";
import { insertNormalizedItems } from "../db/queries/normalized-items";
import { createOutput } from "../db/queries/outputs";
import { insertRawItems } from "../db/queries/raw-items";
import { createRun, finishRun } from "../db/queries/runs";
import { collectCustomApiSource } from "../adapters/custom-api";
import { collectDigestFeedSource } from "../adapters/digest-feed";
import { collectGitHubTrendingSource } from "../adapters/github-trending";
import { collectJsonFeedSource } from "../adapters/json-feed-collect";
import { collectHnSource } from "../adapters/hn";
import { collectOpmlRssSource } from "../adapters/opml-rss";
import { collectRedditSource } from "../adapters/reddit";
import { collectRssSource } from "../adapters/rss";
import { collectWebsiteSource } from "../adapters/website";
import { collectXBirdSource } from "../adapters/x-bird";
import type { AiClient } from "../ai/client";
import { buildCandidateQualityPrompt, buildClusterSummaryPrompt, buildDigestNarrationPrompt } from "../ai/prompts";
import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig } from "../config/load";
import { resolveProfileSelection } from "../config/resolve-profile";
import { collectSources, type CollectDependencies } from "../pipeline/collect";
import { normalizeItems } from "../pipeline/normalize";
import { dedupeExact } from "../pipeline/dedupe-exact";
import { dedupeNear } from "../pipeline/dedupe-near";
import { rankCandidates } from "../pipeline/rank";
import { buildClusters } from "../pipeline/cluster";
import { enrichCandidates } from "../pipeline/enrich";
import { renderDigestMarkdown } from "../render/digest";
import { scoreTopicMatch } from "../pipeline/topic-match";
import type { Database } from "bun:sqlite";
import { parseRawItemMetadata, type RawItem, type RankedCandidate, type Source, type SourcePack, type TopicDefinition, type TopicProfile, type TopicRule } from "../types/index";

export interface RunDigestArgs {
  profileId: string;
  dryRun?: boolean;
  dbPath?: string;
}

export interface RunDigestDependencies {
  aiClient?: AiClient | null;
  db?: Database;
  loadSources?: () => Promise<Source[]> | Source[];
  loadProfiles?: () => Promise<TopicProfile[]> | TopicProfile[];
  loadTopics?: () => Promise<TopicDefinition[]> | TopicDefinition[];
  loadSourcePacks?: () => Promise<SourcePack[]> | SourcePack[];
  collectSources?: (sources: Source[], dependencies: CollectDependencies) => Promise<RawItem[]>;
  buildClusters?: typeof buildClusters;
  now?: () => string;
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

function toCandidates(items: ReturnType<typeof normalizeItems>, topicRule: TopicRule): RankedCandidate[] {
  return items.map((item) => ({
    ...(() => {
      const metadata = parseRawItemMetadata(item.metadataJson);
      return {
        contentType: item.contentType ?? metadata?.contentType,
        sourceType: item.sourceType ?? metadata?.sourceType,
      };
    })(),
    id: item.id,
    title: item.title,
    url: item.url,
    sourceId: item.sourceId,
    sourceName: item.sourceId ?? "Unknown",
    normalizedTitle: item.normalizedTitle,
    normalizedText: item.normalizedText,
    canonicalUrl: item.canonicalUrl,
    processedAt: item.processedAt,
    sourceWeightScore: 1,
    freshnessScore: 1,
    engagementScore: item.engagementScore ?? 0,
    topicMatchScore: scoreTopicMatch(item, topicRule),
    contentQualityAi: 0,
  }));
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

function resolveDigestTimestamp(item: RawItem): number | null {
  const timestamp = item.publishedAt ?? item.fetchedAt;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
}

function filterItemsToLast24Hours(items: RawItem[], nowIso: string): RawItem[] {
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    return items;
  }

  const cutoffMs = nowMs - (24 * 60 * 60 * 1000);
  return items.filter((item) => {
    const itemMs = resolveDigestTimestamp(item);
    return itemMs !== null && itemMs >= cutoffMs && itemMs <= nowMs;
  });
}

export async function runDigest(args: RunDigestArgs, dependencies: RunDigestDependencies = {}): Promise<{ markdown: string; runId: string }> {
  const db = dependencies.db ?? createDb(args.dbPath ?? ":memory:");
  const now = dependencies.now ?? (() => new Date().toISOString());
  const runId = `run-digest-${Date.now()}`;
  const collectImpl = dependencies.collectSources ?? collectSources;
  const clusterImpl = dependencies.buildClusters ?? buildClusters;
  const [sources, profiles, topics, sourcePacks] = await Promise.all([
    Promise.resolve(dependencies.loadSources?.() ?? loadSourcesConfig("config/sources.example.yaml")),
    Promise.resolve(dependencies.loadProfiles?.() ?? loadProfilesConfig("config/profiles.example.yaml")),
    Promise.resolve(dependencies.loadTopics?.() ?? loadTopicsConfig("config/topics.example.yaml")),
    Promise.resolve(dependencies.loadSourcePacks?.() ?? loadDefaultSourcePacks()),
  ]);
  const selection = resolveProfileSelection({
    profileId: args.profileId,
    profiles,
    sourcePacks,
    sources,
  });
  const selectedSources = sources.filter((source) => selection.sourceIds.includes(source.id));
  const topicRule = buildTopicRule(topics, selection.topicIds);
  const aiClient = dependencies.aiClient ?? null;

  createRun(db, {
    id: runId,
    mode: "digest",
    sourceSelectionJson: JSON.stringify(selection.sourceIds),
    paramsJson: JSON.stringify({
      profileId: args.profileId,
      dryRun: Boolean(args.dryRun),
      topicIds: selection.topicIds,
      sourcePackIds: selection.profile.sourcePackIds ?? [],
    }),
    status: "running",
    createdAt: now(),
  });

  const items = filterItemsToLast24Hours(await collectImpl(selectedSources, buildDefaultCollectDependencies()), now());
  const normalized = normalizeItems(items);
  if (!args.dryRun) {
    insertRawItems(db, items);
    insertNormalizedItems(db, normalized);
  }
  const exact = dedupeExact(normalized.filter((item) => item.exactDedupKey) as Array<typeof normalized[number] & { exactDedupKey: string }>);
  const near = dedupeNear(exact.filter((item) => item.processedAt) as Array<typeof exact[number] & { processedAt: string }>);
  const baseCandidates = await enrichCandidates(toCandidates(near, topicRule), {
    limit: 5,
    scoreCandidate: aiClient
      ? async (candidate) =>
        aiClient.scoreCandidate(
          buildCandidateQualityPrompt(candidate.title ?? candidate.normalizedTitle ?? candidate.id, candidate.normalizedText ?? ""),
        )
      : undefined,
  });

  const ranked = rankCandidates(baseCandidates);
  const clusters = clusterImpl(
    ranked.map((candidate) => ({
      id: candidate.id,
      normalizedTitle: candidate.normalizedTitle ?? candidate.id,
      finalScore: candidate.finalScore,
      url: candidate.url ?? candidate.canonicalUrl,
      summary: candidate.rationale,
    })),
    runId,
  );
  if (!args.dryRun) {
    insertClusters(db, clusters);
  }

  const topClusters = clusters.slice(0, 5);
  if (aiClient) {
    for (const cluster of topClusters) {
      const summary = await aiClient.summarizeCluster(
        buildClusterSummaryPrompt(cluster.title ?? cluster.canonicalItemId, cluster.memberItemIds),
      );
      cluster.summary = summary;
    }
  }

  const highlights = ranked.slice(0, 3).map((item) => item.title ?? item.normalizedTitle ?? item.id);
  let narration: string | undefined;
  if (aiClient && highlights.length > 0) {
    narration = await aiClient.narrateDigest(buildDigestNarrationPrompt(highlights));
    narration = narration.trim() === "" ? undefined : narration;
  }

  const markdown = renderDigestMarkdown({
    narration,
    highlights,
    clusters: clusters.map((cluster) => ({
      title: cluster.title ?? cluster.canonicalItemId,
      summary: cluster.summary ?? "Why it matters",
      url: cluster.url ?? "",
    })),
    supportingItems: ranked.slice(3).map((item) => ({
      title: item.title ?? item.normalizedTitle ?? item.id,
      url: item.url ?? item.canonicalUrl ?? "",
    })),
  });

  if (!args.dryRun) {
    createOutput(db, {
      id: `output-${runId}`,
      runId,
      mode: "digest",
      format: "markdown",
      body: markdown,
      createdAt: now(),
    });
  }

  finishRun(db, runId, "succeeded", now());
  return { markdown, runId };
}
