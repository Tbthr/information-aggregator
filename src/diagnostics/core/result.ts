// Diagnostics Framework Core Result Aggregation

import type {
  DiagnosticsMode,
  DiagnosticsEnv,
  DiagnosticsRiskLevel,
  DiagnosticsStageResult,
  DiagnosticsAssertion,
  DiagnosticsRunResult,
  CollectionDiagnosticsSection,
  ReportsDiagnosticsSection,
} from "./types";

export type { DiagnosticsStageResult };

/**
 * Summarizes stage statuses into pass/warn/fail/skip counts
 */
export function summarizeStageStatuses(
  stages: DiagnosticsStageResult[]
): { pass: number; warn: number; fail: number; skip: number } {
  return stages.reduce(
    (acc, stage) => {
      switch (stage.status) {
        case "PASS":
          acc.pass++;
          break;
        case "WARN":
          acc.warn++;
          break;
        case "FAIL":
          acc.fail++;
          break;
        case "SKIP":
          acc.skip++;
          break;
      }
      return acc;
    },
    { pass: 0, warn: 0, fail: 0, skip: 0 }
  );
}

/**
 * Derives the run-level status from stage results.
 * FAIL > WARN > PASS > SKIP (in severity order)
 */
export function deriveRunStatus(stages: DiagnosticsStageResult[]): "PASS" | "WARN" | "FAIL" | "SKIP" {
  if (stages.length === 0) {
    return "PASS";
  }

  const hasFail = stages.some((s) => s.status === "FAIL");
  if (hasFail) {
    return "FAIL";
  }

  const hasWarn = stages.some((s) => s.status === "WARN");
  if (hasWarn) {
    return "WARN";
  }

  const allSkip = stages.every((s) => s.status === "SKIP");
  if (allSkip) {
    return "SKIP";
  }

  return "PASS";
}

export interface CreateRunResultOptions {
  mode: DiagnosticsMode;
  effectiveEnv: DiagnosticsEnv;
  inferredEnv: DiagnosticsEnv | "unknown";
  dbHost: string;
  riskLevel: DiagnosticsRiskLevel;
  stages: DiagnosticsStageResult[];
  assertions: DiagnosticsAssertion[];
  apiTarget?: DiagnosticsRunResult["apiTarget"];
  sections?: {
    collection?: CollectionDiagnosticsSection;
    reports?: ReportsDiagnosticsSection;
  };
}

/**
 * Creates a fully-populated DiagnosticsRunResult
 */
export function createRunResult(options: CreateRunResultOptions): DiagnosticsRunResult {
  const { mode, effectiveEnv, inferredEnv, dbHost, riskLevel, stages, assertions, apiTarget, sections } = options;

  const startedAt = new Date().toISOString();
  const summary = summarizeStageStatuses(stages);
  const status = deriveRunStatus(stages);
  // Calculate duration after creating the result (caller should measure)
  const durationMs = 0;

  return {
    mode,
    startedAt,
    finishedAt: startedAt,
    durationMs,
    effectiveEnv,
    inferredEnv,
    dbHost,
    apiTarget,
    riskLevel,
    status,
    summary,
    stages,
    assertions,
    sections,
  };
}
