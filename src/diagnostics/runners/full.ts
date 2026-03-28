// Diagnostics Framework Full Runner

import { runCollectionDiagnostics } from "./collection";
import { runReportsDiagnostics } from "./reports";
import { deriveRiskLevel } from "../core/guards";
import { createRunResult, summarizeStageStatuses, deriveRunStatus } from "../core/result";
import { prisma } from "@/lib/prisma";
import type { DiagnosticsMode, DiagnosticsArgs, DiagnosticsStageResult, DiagnosticsAssertion, DiagnosticsRunResult } from "../core/types";
import type { CollectionDiagnosticsSection, ReportsDiagnosticsSection } from "../core/types";

export interface FullRunnerOptions {
  args: DiagnosticsArgs;
  effectiveEnv: "test" | "production";
  inferredEnv: "test" | "production" | "unknown";
  dbHost: string;
  apiUrl: string;
  verbose?: boolean;
}

/**
 * Runs the full diagnostics pipeline: collection runner followed by reports runner.
 *
 * Merges stages and sections into a single DiagnosticsRunResult.
 */
export async function runFullDiagnostics(
  options: FullRunnerOptions
): Promise<DiagnosticsRunResult> {
  const { args, effectiveEnv, inferredEnv, dbHost, apiUrl, verbose = false } = options;
  const log = (...msg: string[]) => {
    if (verbose) console.log("[full runner]", ...msg);
  };

  const startedAt = new Date().toISOString();
  const allStages: DiagnosticsStageResult[] = [];
  const allAssertions: DiagnosticsAssertion[] = [];
  let collectionSection: CollectionDiagnosticsSection | undefined;
  let reportsSection: ReportsDiagnosticsSection | undefined;

  // ── Cleanup (before runners, to clear old data) ──────────────
  if (args.cleanup) {
    const cleanupStart = Date.now();
    try {
      if (args.runCollection) {
        await prisma.item.deleteMany({});
      }
      if (!args.weeklyOnly) {
        await prisma.dailyOverview.deleteMany({});
      }
      if (!args.dailyOnly) {
        await prisma.weeklyReport.deleteMany({});
      }

      allStages.push({
        key: "cleanup",
        label: "Cleanup",
        category: "system",
        status: "PASS",
        durationMs: Date.now() - cleanupStart,
        details: "old test data cleaned up before run",
      });
    } catch (err) {
      allStages.push({
        key: "cleanup",
        label: "Cleanup",
        category: "system",
        status: "FAIL",
        durationMs: Date.now() - cleanupStart,
        details: `cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ── Collection Runner ───────────────────────────────────────
  log("starting collection diagnostics...");
  const collectionResult = await runCollectionDiagnostics({
    args,
    effectiveEnv,
    dbHost,
    verbose,
  });

  allStages.push(...collectionResult.result.stages);
  allAssertions.push(...collectionResult.result.assertions);
  collectionSection = collectionResult.result.sections?.collection;

  log("collection diagnostics complete");

  // ── Reports Runner ──────────────────────────────────────────
  log("starting reports diagnostics...");
  const reportsResult = await runReportsDiagnostics({
    args,
    effectiveEnv,
    dbHost,
    apiUrl,
    verbose,
  });

  allStages.push(...reportsResult.stages);
  allAssertions.push(...reportsResult.assertions);
  reportsSection = reportsResult.sections?.reports;

  log("reports diagnostics complete");

  // ── Merge & Finalize ────────────────────────────────────────
  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  const riskLevel = deriveRiskLevel("full", {
    runCollection: args.runCollection,
    cleanup: args.cleanup,
    configOnly: args.configOnly,
    dailyOnly: args.dailyOnly,
    weeklyOnly: args.weeklyOnly,
  });

  const summary = summarizeStageStatuses(allStages);
  const status = deriveRunStatus(allStages);

  const mode: DiagnosticsMode = "full";
  const result: DiagnosticsRunResult = {
    mode,
    startedAt,
    finishedAt,
    durationMs,
    effectiveEnv,
    inferredEnv,
    dbHost,
    riskLevel,
    status,
    summary,
    stages: allStages,
    assertions: allAssertions,
    sections: {
      collection: collectionSection,
      reports: reportsSection,
    },
  };

  return result;
}
