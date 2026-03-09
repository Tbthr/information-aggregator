import { createDb } from "../db/client";
import { createOutput } from "../db/queries/outputs";
import { insertNormalizedItems } from "../db/queries/normalized-items";
import { insertRawItems } from "../db/queries/raw-items";
import { createRun, finishRun } from "../db/queries/runs";
import { recordSourceFailureWithMetrics, recordSourceSuccessWithMetrics } from "../db/queries/source-health";
import { collectJsonFeedSource } from "../adapters/json-feed-collect";
import { collectHnSource } from "../adapters/hn";
import { collectRedditSource } from "../adapters/reddit";
import { collectRssSource } from "../adapters/rss";
import { collectWebsiteSource } from "../adapters/website";
import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig } from "../config/load";
import { resolveProfileSelection } from "../config/resolve-profile";
import { normalizeItems } from "../pipeline/normalize";
import { dedupeExact } from "../pipeline/dedupe-exact";
import { dedupeNear } from "../pipeline/dedupe-near";
import { collectSources, type CollectDependencies } from "../pipeline/collect";
import { rankCandidates } from "../pipeline/rank";
import { renderScanMarkdown } from "../render/scan";
import { scoreTopicMatch } from "../pipeline/topic-match";
import type { Database } from "bun:sqlite";
import type { RawItem, RankedCandidate, Source, SourcePack, TopicDefinition, TopicProfile, TopicRule } from "../types/index";

export interface RunScanArgs {
  profileId: string;
  dryRun?: boolean;
  dbPath?: string;
}

export interface RunScanDependencies {
  db?: Database;
  loadSources?: () => Promise<Source[]> | Source[];
  loadProfiles?: () => Promise<TopicProfile[]> | TopicProfile[];
  loadTopics?: () => Promise<TopicDefinition[]> | TopicDefinition[];
  loadSourcePacks?: () => Promise<SourcePack[]> | SourcePack[];
  collectSources?: (sources: Source[], dependencies: CollectDependencies) => Promise<RawItem[]>;
  now?: () => string;
  topicRule?: TopicRule;
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

function toCandidates(items: ReturnType<typeof normalizeItems>, topicRule?: TopicRule): RankedCandidate[] {
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
    topicMatchScore: scoreTopicMatch(item, topicRule ?? {}),
    contentQualityAi: 0,
  }));
}

export async function runScan(args: RunScanArgs, dependencies: RunScanDependencies = {}): Promise<{ markdown: string; runId: string }> {
  const db = dependencies.db ?? createDb(args.dbPath ?? ":memory:");
  const now = dependencies.now ?? (() => new Date().toISOString());
  const runId = `run-scan-${Date.now()}`;
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
  const resolvedTopicRule = dependencies.topicRule ?? buildTopicRule(topics, selection.topicIds);

  createRun(db, {
    id: runId,
    mode: "scan",
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

  const collectImpl = dependencies.collectSources ?? collectSources;
  const items = await collectImpl(selectedSources, {
    ...buildDefaultCollectDependencies(),
    onSourceEvent: (event) => {
      if (event.status === "failure") {
        recordSourceFailureWithMetrics(db, event.sourceId, {
          error: event.error ?? "unknown",
          fetchedAt: now(),
          latencyMs: event.latencyMs,
        });
      } else {
        recordSourceSuccessWithMetrics(db, event.sourceId, {
          fetchedAt: now(),
          latencyMs: event.latencyMs,
          itemCount: event.itemCount,
        });
      }
    },
  });

  const normalized = normalizeItems(items);
  if (!args.dryRun) {
    insertRawItems(db, items);
    insertNormalizedItems(db, normalized);
  }
  const exact = dedupeExact(normalized.filter((item) => item.exactDedupKey) as Array<typeof normalized[number] & { exactDedupKey: string }>);
  const near = dedupeNear(exact.filter((item) => item.processedAt) as Array<typeof exact[number] & { processedAt: string }>);
  const ranked = rankCandidates(toCandidates(near, resolvedTopicRule));
  const markdown = renderScanMarkdown(
    ranked.map((item) => ({
      title: item.title ?? item.normalizedTitle ?? item.id,
      url: item.url ?? item.canonicalUrl ?? "",
      finalScore: item.finalScore,
      sourceName: item.sourceName ?? "Unknown",
      rationale: item.topicMatchScore > 0 ? "Matches topic profile" : undefined,
    })),
  );

  if (!args.dryRun) {
    createOutput(db, {
      id: `output-${runId}`,
      runId,
      mode: "scan",
      format: "markdown",
      body: markdown,
      createdAt: now(),
    });
  }

  finishRun(db, runId, "succeeded", now());
  return { markdown, runId };
}
