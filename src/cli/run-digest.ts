import type { Database } from "bun:sqlite";

import type { AiClient } from "../ai/client";
import { buildClusterSummaryPrompt, buildDigestNarrationPrompt } from "../ai/prompts";
import { createDb } from "../db/client";
import { insertClusters } from "../db/queries/clusters";
import { insertNormalizedItems } from "../db/queries/normalized-items";
import { createOutput } from "../db/queries/outputs";
import { insertRawItems } from "../db/queries/raw-items";
import { createRun, finishRun } from "../db/queries/runs";
import type { RunQueryDependencies } from "../query/run-query";
import { runQuery } from "../query/run-query";
import { buildViewModel, renderViewMarkdown, type ViewModel } from "../views/registry";

export interface RunDigestArgs {
  profileId: string;
  dryRun?: boolean;
  dbPath?: string;
}

export interface RunDigestDependencies extends RunQueryDependencies {
  aiClient?: AiClient | null;
  db?: Database;
}

async function applyDigestAi(viewModel: ViewModel, aiClient: AiClient | null): Promise<ViewModel> {
  if (!aiClient) {
    return viewModel;
  }

  const highlights = viewModel.highlights ?? [];
  const topClusters = viewModel.sections.find((section) => section.title === "Top Clusters");
  if (topClusters) {
    for (const item of topClusters.items) {
      item.summary = await aiClient.summarizeCluster(buildClusterSummaryPrompt(item.title, [item.title]));
    }
  }

  if (highlights.length > 0) {
    viewModel.summary = await aiClient.narrateDigest(buildDigestNarrationPrompt(highlights));
  }

  return viewModel;
}

export async function runDigest(args: RunDigestArgs, dependencies: RunDigestDependencies = {}): Promise<{ markdown: string; runId: string }> {
  const db = dependencies.db ?? createDb(args.dbPath ?? ":memory:");
  const now = dependencies.now ?? (() => new Date().toISOString());
  const runId = `run-digest-${Date.now()}`;

  createRun(db, {
    id: runId,
    mode: "digest",
    sourceSelectionJson: JSON.stringify([]),
    paramsJson: JSON.stringify({
      profileId: args.profileId,
      dryRun: Boolean(args.dryRun),
      viewId: "daily-brief",
    }),
    status: "running",
    createdAt: now(),
  });

  const queryResult = await runQuery(
    {
      command: "run",
      profileId: args.profileId,
      viewId: "daily-brief",
      format: "markdown",
    },
    dependencies,
  );
  const viewModel = await applyDigestAi(buildViewModel(queryResult, "daily-brief"), dependencies.aiClient ?? null);
  const markdown = renderViewMarkdown(viewModel, "daily-brief");

  if (!args.dryRun) {
    insertRawItems(db, queryResult.items);
    insertNormalizedItems(db, queryResult.normalizedItems);
    insertClusters(
      db,
      queryResult.clusters.map((cluster) => ({
        ...cluster,
        runId,
      })),
    );
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
