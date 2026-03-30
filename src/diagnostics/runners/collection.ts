// Diagnostics Framework Collection Runner

import { createRunResult } from "../core/result";
import { loadSourceHealthSummary } from "../collection/health";
import { loadCollectionInventory, buildPersistedSummary } from "../collection/inventory";
import { runCollection, type RunCollectionResult } from "../collection/run-collection";
import type { DiagnosticsMode, DiagnosticsArgs, DiagnosticsStageResult, DiagnosticsAssertion } from "../core/types";
import type { CollectionDiagnosticsSection } from "../core/types";

export interface CollectionRunnerOptions {
  args: DiagnosticsArgs;
  effectiveEnv: "test" | "production";
  dbHost: string;
  verbose?: boolean;
}

/**
 * Runs the collection diagnostics pipeline.
 *
 * Orchestrates:
 * 1. Guards check (already validated before runner is called)
 * 2. Health load
 * 3. Inventory load
 * 4. Optional collection run (only with --run-collection)
 * 5. Candidate summary (if collection was run)
 *
 * Returns a fully-populated DiagnosticsRunResult.
 */
export async function runCollectionDiagnostics(
  options: CollectionRunnerOptions
): Promise<{ result: import("../core/types").DiagnosticsRunResult; runCollectionResult?: RunCollectionResult }> {
  const { args, effectiveEnv, dbHost, verbose = false } = options;
  const log = (...msg: string[]) => {
    if (verbose) console.log("[collection runner]", ...msg);
  };

  const startedAt = new Date().toISOString();
  const stages: DiagnosticsStageResult[] = [];
  const assertions: DiagnosticsAssertion[] = [];
  const collectionSection: CollectionDiagnosticsSection = {};

  // ── Stage: Guards ───────────────────────────────────────────
  // Guards have already been validated by normalizeAndValidateArgs before this runner is called.
  // This stage just records that we checked them.
  const guardsStart = Date.now();
  stages.push({
    key: "guards",
    label: "Guards",
    category: "system",
    status: "PASS",
    durationMs: 0, // Guards are checked before runner, no measurable duration
    details: "argument validation and environment guards passed",
  });
  log("guards stage complete");

  // ── Stage: Health ───────────────────────────────────────────
  const healthStart = Date.now();
  try {
    const healthRecords = await loadSourceHealthSummary();
    const healthDurationMs = Date.now() - healthStart;

    const failingCount = healthRecords.filter((h) => h.status === "failing").length;
    const warningCount = healthRecords.filter((h) => h.status === "warning").length;

    let healthStatus: "PASS" | "WARN" | "FAIL" | "SKIP" = "PASS";
    if (failingCount > 0) {
      healthStatus = "FAIL";
    } else if (warningCount > 0) {
      healthStatus = "WARN";
    }

    stages.push({
      key: "health",
      label: "Health",
      category: "collection",
      status: healthStatus,
      durationMs: healthDurationMs,
      details: `${healthRecords.length} sources checked (${failingCount} failing, ${warningCount} warning)`,
      data: {
        totalSources: healthRecords.length,
        failingCount,
        warningCount,
      },
    });

    collectionSection.health = healthRecords;

    assertions.push({
      id: "C-01",
      category: "collection",
      status: healthStatus === "PASS" ? "PASS" : healthStatus === "WARN" ? "WARN" : "FAIL",
      blocking: healthStatus === "FAIL",
      message:
        healthStatus === "PASS"
          ? "all sources healthy"
          : healthStatus === "WARN"
            ? `${warningCount} sources with warnings`
            : `${failingCount} sources failing`,
      evidence: { failingCount, warningCount, totalSources: healthRecords.length },
    });
    log(`health stage complete: ${healthRecords.length} sources`);
  } catch (err) {
    const healthDurationMs = Date.now() - healthStart;
    stages.push({
      key: "health",
      label: "Health",
      category: "collection",
      status: "FAIL",
      durationMs: healthDurationMs,
      details: `failed to load health: ${err instanceof Error ? err.message : String(err)}`,
    });
    assertions.push({
      id: "C-01",
      category: "collection",
      status: "FAIL",
      blocking: true,
      message: "failed to load source health",
      evidence: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  // ── Stage: Inventory ────────────────────────────────────────
  const inventoryStart = Date.now();
  try {
    const inventory = await loadCollectionInventory();
    const inventoryDurationMs = Date.now() - inventoryStart;

    stages.push({
      key: "inventory",
      label: "Inventory",
      category: "collection",
      status: "PASS",
      durationMs: inventoryDurationMs,
      data: {
        contentCount: inventory.contentCount,
        sourceCount: inventory.sourceCount,
        unhealthySourceCount: inventory.unhealthySourceCount,
      },
    });

    collectionSection.inventory = inventory;

    // Persisted summary (top content)
    const persistedSummary = await buildPersistedSummary(20);
    collectionSection.persistedSummary = persistedSummary;

    assertions.push({
      id: "C-02",
      category: "collection",
      status: "PASS",
      blocking: false,
      message: `inventory: ${inventory.contentCount} content, ${inventory.sourceCount} sources`,
      evidence: { contentCount: inventory.contentCount, sourceCount: inventory.sourceCount },
    });
    log(`inventory stage complete: ${inventory.contentCount} content`);
  } catch (err) {
    const inventoryDurationMs = Date.now() - inventoryStart;
    stages.push({
      key: "inventory",
      label: "Inventory",
      category: "collection",
      status: "FAIL",
      durationMs: inventoryDurationMs,
      details: `failed to load inventory: ${err instanceof Error ? err.message : String(err)}`,
    });
    assertions.push({
      id: "C-02",
      category: "collection",
      status: "FAIL",
      blocking: true,
      message: "failed to load inventory",
      evidence: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  // ── Stage: Collection Run (optional) ───────────────────────
  let runCollectionResult: RunCollectionResult | undefined;

  if (args.runCollection) {
    const runStart = Date.now();
    try {
      log("starting collection run...");
      const result = await runCollection();
      runCollectionResult = result;
      const runDurationMs = Date.now() - runStart;

      const successCount = result.sourceEvents.filter((e) => e.status === "success").length;
      const failureCount = result.sourceEvents.filter((e) => e.status === "failure").length;

      let runStatus: "PASS" | "WARN" | "FAIL" = "PASS";
      if (failureCount > 0) {
        runStatus = "WARN";
      }

      stages.push({
        key: "collection-run",
        label: "Collection Run",
        category: "collection",
        status: runStatus,
        durationMs: runDurationMs,
        data: {
          triggered: result.triggered,
          sourceCount: result.sourceEvents.length,
          successCount,
          failureCount,
        },
      });

      collectionSection.run = {
        triggered: result.triggered,
        sourceEvents: result.sourceEvents,
        counts: result.counts,
      };

      // Note: candidates are not exposed by runCollection() - they are internal to the pipeline.
      // runCandidateSummary is therefore not populated by the runner.

      assertions.push({
        id: "C-03",
        category: "collection",
        status: runStatus,
        blocking: false,
        message: `collection run: ${successCount} succeeded, ${failureCount} failed, ${result.counts.raw} raw items`,
        evidence: {
          successCount,
          failureCount,
          rawItems: result.counts.raw,
          afterNearDedup: result.counts.afterNearDedup,
        },
      });
      log(`collection run complete: ${successCount} succeeded, ${failureCount} failed`);
    } catch (err) {
      const runDurationMs = Date.now() - runStart;
      stages.push({
        key: "collection-run",
        label: "Collection Run",
        category: "collection",
        status: "FAIL",
        durationMs: runDurationMs,
        details: `collection run failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      assertions.push({
        id: "C-03",
        category: "collection",
        status: "FAIL",
        blocking: true,
        message: "collection run failed",
        evidence: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  } else {
    // No collection run - just record this as a skip stage
    stages.push({
      key: "collection-run",
      label: "Collection Run",
      category: "collection",
      status: "SKIP",
      durationMs: 0,
      details: "use --run-collection to trigger a collection run",
    });
    log("collection run skipped (use --run-collection to enable)");
  }

  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  const mode: DiagnosticsMode = "collection";
  const result = createRunResult({
    mode,
    effectiveEnv,
    inferredEnv: effectiveEnv,
    dbHost,
    riskLevel: args.runCollection ? "write" : "read-only",
    stages,
    assertions,
    sections: { collection: collectionSection },
  });

  // Fix durationMs
  (result as typeof result & { durationMs: number }).durationMs = durationMs;
  (result as typeof result & { finishedAt: string }).finishedAt = finishedAt;

  return { result, runCollectionResult };
}
