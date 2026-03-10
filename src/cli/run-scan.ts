import type { Database } from "bun:sqlite";

import { createDb } from "../db/client";
import { insertNormalizedItems } from "../db/queries/normalized-items";
import { createOutput } from "../db/queries/outputs";
import { insertRawItems } from "../db/queries/raw-items";
import { createRun, finishRun } from "../db/queries/runs";
import type { RunQueryDependencies } from "../query/run-query";
import { runQuery } from "../query/run-query";
import { buildViewModel, renderViewMarkdown } from "../views/registry";

export interface RunScanArgs {
  profileId: string;
  dryRun?: boolean;
  dbPath?: string;
}

export interface RunScanDependencies extends RunQueryDependencies {
  db?: Database;
}

export async function runScan(args: RunScanArgs, dependencies: RunScanDependencies = {}): Promise<{ markdown: string; runId: string }> {
  const db = dependencies.db ?? createDb(args.dbPath ?? ":memory:");
  const now = dependencies.now ?? (() => new Date().toISOString());
  const runId = `run-scan-${Date.now()}`;

  createRun(db, {
    id: runId,
    mode: "scan",
    sourceSelectionJson: JSON.stringify([]),
    paramsJson: JSON.stringify({
      profileId: args.profileId,
      dryRun: Boolean(args.dryRun),
      viewId: "item-list",
    }),
    status: "running",
    createdAt: now(),
  });

  const queryResult = await runQuery(
    {
      command: "run",
      profileId: args.profileId,
      viewId: "item-list",
      format: "markdown",
    },
    dependencies,
  );
  const viewModel = buildViewModel(queryResult, "item-list");
  const markdown = renderViewMarkdown(viewModel, "item-list");

  if (!args.dryRun) {
    insertRawItems(db, queryResult.items);
    insertNormalizedItems(db, queryResult.normalizedItems);
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
