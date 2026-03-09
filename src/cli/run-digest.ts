import { createDb } from "../db/client";
import { insertClusters } from "../db/queries/clusters";
import { insertNormalizedItems } from "../db/queries/normalized-items";
import { createOutput } from "../db/queries/outputs";
import { insertRawItems } from "../db/queries/raw-items";
import { createRun, finishRun } from "../db/queries/runs";
import { collectJsonFeedSource } from "../adapters/json-feed-collect";
import { collectHnSource } from "../adapters/hn";
import { collectRedditSource } from "../adapters/reddit";
import { collectRssSource } from "../adapters/rss";
import { collectWebsiteSource } from "../adapters/website";
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
import { renderDigestMarkdown } from "../render/digest";
import { scoreTopicMatch } from "../pipeline/topic-match";
import type { Database } from "bun:sqlite";
import type { RawItem, RankedCandidate, Source, SourcePack, TopicDefinition, TopicProfile, TopicRule } from "../types/index";

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
    loadSourcePacksConfig("config/packs/ai-daily-digest-blogs.yaml"),
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
    engagementScore: 0,
    topicMatchScore: scoreTopicMatch(item, topicRule),
    contentQualityAi: 0,
  }));
}

function buildDefaultCollectDependencies(): CollectDependencies {
  return {
    adapters: {
      hn: (source) => collectHnSource(source),
      reddit: (source) => collectRedditSource(source),
      "json-feed": (source) => collectJsonFeedSource(source),
      rss: (source) => collectRssSource(source),
      website: (source) => collectWebsiteSource(source),
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
  const baseCandidates = toCandidates(near, topicRule);

  if (aiClient) {
    for (const candidate of baseCandidates.slice(0, 5)) {
      candidate.contentQualityAi = await aiClient.scoreCandidate(
        buildCandidateQualityPrompt(candidate.title ?? candidate.normalizedTitle ?? candidate.id, candidate.normalizedText ?? ""),
      );
    }
  }

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
  if (aiClient && highlights.length > 0) {
    const narration = await aiClient.narrateDigest(buildDigestNarrationPrompt(highlights));
    if (narration.trim() !== "") {
      highlights[0] = narration;
    }
  }

  const markdown = renderDigestMarkdown({
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
