import { createDb } from "../db/client";
import { createOutput } from "../db/queries/outputs";
import { createRun, finishRun } from "../db/queries/runs";
import { listEnabledSources } from "../db/queries/sources";
import { collectJsonFeedSource } from "../adapters/json-feed-collect";
import { collectRssSource } from "../adapters/rss";
import { collectWebsiteSource } from "../adapters/website";
import { collectSources, type CollectDependencies } from "../pipeline/collect";
import { normalizeItems } from "../pipeline/normalize";
import { dedupeExact } from "../pipeline/dedupe-exact";
import { dedupeNear } from "../pipeline/dedupe-near";
import { rankCandidates } from "../pipeline/rank";
import { buildClusters } from "../pipeline/cluster";
import { renderDigestMarkdown } from "../render/digest";
import type { Database } from "bun:sqlite";
import type { RawItem, RankedCandidate, Source } from "../types/index";

export interface RunDigestArgs {
  profileId: string;
  dryRun?: boolean;
  dbPath?: string;
}

export interface RunDigestDependencies {
  db?: Database;
  listSources?: () => Source[];
  collectSources?: (sources: Source[], dependencies: CollectDependencies) => Promise<RawItem[]>;
  buildClusters?: typeof buildClusters;
  now?: () => string;
}

function toCandidates(items: ReturnType<typeof normalizeItems>): RankedCandidate[] {
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
    topicMatchScore: 0,
    contentQualityAi: 0,
  }));
}

function buildDefaultCollectDependencies(): CollectDependencies {
  return {
    adapters: {
      "json-feed": (source) => collectJsonFeedSource(source),
      rss: (source) => collectRssSource(source),
      website: (source) => collectWebsiteSource(source),
    },
  };
}

export async function runDigest(args: RunDigestArgs, dependencies: RunDigestDependencies = {}): Promise<{ markdown: string; runId: string }> {
  const db = dependencies.db ?? createDb(args.dbPath ?? ":memory:");
  const now = dependencies.now ?? (() => new Date().toISOString());
  const runId = `run-digest-${Date.now()}`;
  const collectImpl = dependencies.collectSources ?? collectSources;
  const clusterImpl = dependencies.buildClusters ?? buildClusters;

  createRun(db, {
    id: runId,
    mode: "digest",
    sourceSelectionJson: "[]",
    paramsJson: JSON.stringify({ profileId: args.profileId, dryRun: Boolean(args.dryRun) }),
    status: "running",
    createdAt: now(),
  });

  const sources = dependencies.listSources?.() ?? listEnabledSources(db);
  const items = await collectImpl(sources, buildDefaultCollectDependencies());
  const normalized = normalizeItems(items);
  const exact = dedupeExact(normalized.filter((item) => item.exactDedupKey) as Array<typeof normalized[number] & { exactDedupKey: string }>);
  const near = dedupeNear(exact.filter((item) => item.processedAt) as Array<typeof exact[number] & { processedAt: string }>);
  const ranked = rankCandidates(toCandidates(near));
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
  const markdown = renderDigestMarkdown({
    highlights: ranked.slice(0, 3).map((item) => item.title ?? item.normalizedTitle ?? item.id),
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
