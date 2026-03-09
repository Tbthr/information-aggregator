import { createDb } from "../db/client";
import { createOutput } from "../db/queries/outputs";
import { createRun, finishRun } from "../db/queries/runs";
import { recordSourceFailure, recordSourceSuccess, recordSourceZeroItems } from "../db/queries/source-health";
import { listEnabledSources } from "../db/queries/sources";
import { collectJsonFeedSource } from "../adapters/json-feed-collect";
import { collectRssSource } from "../adapters/rss";
import { collectWebsiteSource } from "../adapters/website";
import { normalizeItems } from "../pipeline/normalize";
import { dedupeExact } from "../pipeline/dedupe-exact";
import { dedupeNear } from "../pipeline/dedupe-near";
import { collectSources, type CollectDependencies } from "../pipeline/collect";
import { rankCandidates } from "../pipeline/rank";
import { renderScanMarkdown } from "../render/scan";
import { scoreTopicMatch } from "../pipeline/topic-match";
import type { Database } from "bun:sqlite";
import type { RawItem, RankedCandidate, Source, TopicRule } from "../types/index";

export interface RunScanArgs {
  profileId: string;
  dryRun?: boolean;
  dbPath?: string;
}

export interface RunScanDependencies {
  db?: Database;
  listSources?: () => Source[];
  collectSources?: (sources: Source[], dependencies: CollectDependencies) => Promise<RawItem[]>;
  now?: () => string;
  topicRule?: TopicRule;
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

  createRun(db, {
    id: runId,
    mode: "scan",
    sourceSelectionJson: "[]",
    paramsJson: JSON.stringify({ profileId: args.profileId, dryRun: Boolean(args.dryRun) }),
    status: "running",
    createdAt: now(),
  });

  const sources = dependencies.listSources?.() ?? listEnabledSources(db);
  const collectImpl = dependencies.collectSources ?? collectSources;
  const items = await collectImpl(sources, {
    ...buildDefaultCollectDependencies(),
    onSourceEvent: (event) => {
      if (event.status === "failure") {
        recordSourceFailure(db, event.sourceId, event.error ?? "unknown", now());
      } else if (event.status === "zero-items") {
        recordSourceZeroItems(db, event.sourceId);
      } else {
        recordSourceSuccess(db, event.sourceId, now());
      }
    },
  });

  const normalized = normalizeItems(items);
  const exact = dedupeExact(normalized.filter((item) => item.exactDedupKey) as Array<typeof normalized[number] & { exactDedupKey: string }>);
  const near = dedupeNear(exact.filter((item) => item.processedAt) as Array<typeof exact[number] & { processedAt: string }>);
  const ranked = rankCandidates(toCandidates(near, dependencies.topicRule));
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
