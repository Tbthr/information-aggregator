// Diagnostics Framework Reports Runner

import { createRunResult } from "../core/result";
import { loadReportsInventory, resolveReportsTargets } from "../reports/inventory";
import { runReportsConfigAssertions } from "../reports/config";
import { runDailyAssertions } from "../reports/verify-daily";
import { runWeeklyAssertions } from "../reports/verify-weekly";
import { runIntegrityAssertions } from "../reports/verify-integrity";
import type { DiagnosticsMode, DiagnosticsArgs, DiagnosticsStageResult, DiagnosticsAssertion } from "../core/types";
import type { ReportsDiagnosticsSection } from "../reports/types";

export interface ReportsRunnerOptions {
  args: DiagnosticsArgs;
  effectiveEnv: "test" | "production";
  dbHost: string;
  apiUrl: string;
  verbose?: boolean;
}

/**
 * Runs the reports diagnostics pipeline.
 *
 * Orchestrates:
 * 1. Guards check (already validated before runner is called)
 * 2. Config validation (config-only mode)
 * 3. Inventory load
 * 4. Daily assertions (unless weekly-only)
 * 5. Weekly assertions (unless daily-only)
 * 6. Integrity assertions
 *
 * Returns a fully-populated DiagnosticsRunResult.
 */
export async function runReportsDiagnostics(
  options: ReportsRunnerOptions
): Promise<import("../core/types").DiagnosticsRunResult> {
  const { args, effectiveEnv, dbHost, apiUrl, verbose = false } = options;
  const log = (...msg: string[]) => {
    if (verbose) console.log("[reports runner]", ...msg);
  };

  const startedAt = new Date().toISOString();
  const stages: DiagnosticsStageResult[] = [];
  const assertions: DiagnosticsAssertion[] = [];
  const reportsSection: ReportsDiagnosticsSection = {};

  // Determine which substages to run based on args
  const isConfigOnly = args.configOnly === true;
  const isDailyOnly = args.dailyOnly === true;
  const isWeeklyOnly = args.weeklyOnly === true;

  // ── Stage: Guards ───────────────────────────────────────────
  stages.push({
    key: "guards",
    label: "Guards",
    category: "system",
    status: "PASS",
    durationMs: 0,
    details: "argument validation and environment guards passed",
  });
  log("guards stage complete");

  // ── Stage: Config Validation ─────────────────────────────────
  if (isConfigOnly || (!isDailyOnly && !isWeeklyOnly)) {
    const configStart = Date.now();
    try {
      const configAssertions = await runReportsConfigAssertions({
        apiUrl,
        verbose,
        timeout: 60,
      });
      const configDurationMs = Date.now() - configStart;

      const allConfigPass = configAssertions.every((a) => a.status === "PASS");
      const anyConfigFail = configAssertions.some((a) => a.status === "FAIL");
      let configStatus: "PASS" | "WARN" | "FAIL" = "PASS";
      if (anyConfigFail) configStatus = "FAIL";
      else if (configAssertions.some((a) => a.status === "WARN")) configStatus = "WARN";

      stages.push({
        key: "config-validation",
        label: "Config Validation",
        category: "reports",
        status: configStatus,
        durationMs: configDurationMs,
      });

      assertions.push(...configAssertions);
      log(`config validation complete: ${configAssertions.length} assertions`);
    } catch (err) {
      const configDurationMs = Date.now() - configStart;
      stages.push({
        key: "config-validation",
        label: "Config Validation",
        category: "reports",
        status: "FAIL",
        durationMs: configDurationMs,
        details: `config validation failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      assertions.push({
        id: "B-CONFIG",
        category: "api",
        status: "FAIL",
        blocking: true,
        message: "config validation failed",
        evidence: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // ── Stage: Inventory ────────────────────────────────────────
  if (!isConfigOnly) {
    const inventoryStart = Date.now();
    try {
      const inventory = await loadReportsInventory();
      const inventoryDurationMs = Date.now() - inventoryStart;

      stages.push({
        key: "inventory",
        label: "Inventory",
        category: "reports",
        status: "PASS",
        durationMs: inventoryDurationMs,
        data: {
          contents: inventory.contents,
          dailyReports: inventory.dailyReports,
          weeklyReports: inventory.weeklyReports,
          topics: inventory.topics,
        },
      });

      reportsSection.inventory = inventory;

      // Resolve target date and week
      const targets = resolveReportsTargets();
      reportsSection.resolvedTargets = targets;

      assertions.push({
        id: "R-INVENTORY",
        category: "reports",
        status: "PASS",
        blocking: false,
        message: `inventory: ${inventory.contents} content, ${inventory.topics} topics, ${inventory.dailyReports} daily, ${inventory.weeklyReports} weekly reports`,
        evidence: {
          contents: inventory.contents,
          topics: inventory.topics,
          dailyReports: inventory.dailyReports,
          weeklyReports: inventory.weeklyReports,
        },
      });
      log(`inventory stage complete: ${inventory.contents} content`);
    } catch (err) {
      const inventoryDurationMs = Date.now() - inventoryStart;
      stages.push({
        key: "inventory",
        label: "Inventory",
        category: "reports",
        status: "FAIL",
        durationMs: inventoryDurationMs,
        details: `failed to load inventory: ${err instanceof Error ? err.message : String(err)}`,
      });
      assertions.push({
        id: "R-INVENTORY",
        category: "reports",
        status: "FAIL",
        blocking: true,
        message: "failed to load inventory",
        evidence: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // ── Stage: Daily Assertions ──────────────────────────────────
  if (!isWeeklyOnly && !isConfigOnly) {
    const dailyStart = Date.now();
    try {
      const dailyAssertions = await runDailyAssertions({
        apiUrl,
        verbose,
        dailyOnly: isDailyOnly,
        weeklyOnly: isWeeklyOnly,
        timeout: 600,
        pollInterval: 3,
      });
      const dailyDurationMs = Date.now() - dailyStart;

      const allDailyPass = dailyAssertions.every((a) => a.status === "PASS");
      const anyDailyFail = dailyAssertions.some((a) => a.status === "FAIL");
      let dailyStatus: "PASS" | "WARN" | "FAIL" | "SKIP" = "PASS";
      if (anyDailyFail) dailyStatus = "FAIL";
      else if (dailyAssertions.some((a) => a.status === "WARN")) dailyStatus = "WARN";
      else if (dailyAssertions.every((a) => a.status === "SKIP")) dailyStatus = "SKIP";

      stages.push({
        key: "daily",
        label: "Daily Report",
        category: "reports",
        status: dailyStatus,
        durationMs: dailyDurationMs,
      });

      assertions.push(...dailyAssertions);

      // Update section with daily info
      const targets = reportsSection.resolvedTargets!;
      reportsSection.daily = { date: targets.dailyDate };

      log(`daily stage complete: ${dailyAssertions.length} assertions`);
    } catch (err) {
      const dailyDurationMs = Date.now() - dailyStart;
      stages.push({
        key: "daily",
        label: "Daily Report",
        category: "reports",
        status: "FAIL",
        durationMs: dailyDurationMs,
        details: `daily assertions failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      assertions.push({
        id: "R-DAILY",
        category: "reports",
        status: "FAIL",
        blocking: true,
        message: "daily assertions failed",
        evidence: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  } else if (!isConfigOnly) {
    stages.push({
      key: "daily",
      label: "Daily Report",
      category: "reports",
      status: "SKIP",
      durationMs: 0,
      details: isWeeklyOnly ? "weekly-only mode" : "use --daily-only to enable",
    });
  }

  // ── Stage: Weekly Assertions ─────────────────────────────────
  if (!isDailyOnly && !isConfigOnly) {
    const weeklyStart = Date.now();
    try {
      const weeklyAssertions = await runWeeklyAssertions({
        apiUrl,
        verbose,
        dailyOnly: isDailyOnly,
        weeklyOnly: isWeeklyOnly,
        timeout: 600,
        pollInterval: 3,
      });
      const weeklyDurationMs = Date.now() - weeklyStart;

      const allWeeklyPass = weeklyAssertions.every((a) => a.status === "PASS");
      const anyWeeklyFail = weeklyAssertions.some((a) => a.status === "FAIL");
      let weeklyStatus: "PASS" | "WARN" | "FAIL" | "SKIP" = "PASS";
      if (anyWeeklyFail) weeklyStatus = "FAIL";
      else if (weeklyAssertions.some((a) => a.status === "WARN")) weeklyStatus = "WARN";
      else if (weeklyAssertions.every((a) => a.status === "SKIP")) weeklyStatus = "SKIP";

      stages.push({
        key: "weekly",
        label: "Weekly Report",
        category: "reports",
        status: weeklyStatus,
        durationMs: weeklyDurationMs,
      });

      assertions.push(...weeklyAssertions);

      // Update section with weekly info
      const targets = reportsSection.resolvedTargets ?? resolveReportsTargets();
      reportsSection.weekly = { weekNumber: targets.weeklyWeekNumber };

      log(`weekly stage complete: ${weeklyAssertions.length} assertions`);
    } catch (err) {
      const weeklyDurationMs = Date.now() - weeklyStart;
      stages.push({
        key: "weekly",
        label: "Weekly Report",
        category: "reports",
        status: "FAIL",
        durationMs: weeklyDurationMs,
        details: `weekly assertions failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      assertions.push({
        id: "R-WEEKLY",
        category: "reports",
        status: "FAIL",
        blocking: true,
        message: "weekly assertions failed",
        evidence: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  } else if (!isConfigOnly) {
    stages.push({
      key: "weekly",
      label: "Weekly Report",
      category: "reports",
      status: "SKIP",
      durationMs: 0,
      details: isDailyOnly ? "daily-only mode" : "use --weekly-only to enable",
    });
  }

  // ── Stage: Integrity Assertions ───────────────────────────────
  if (!isConfigOnly) {
    const integrityStart = Date.now();
    try {
      const integrityAssertions = await runIntegrityAssertions({
        apiUrl,
        verbose,
        timeout: 120,
      });
      const integrityDurationMs = Date.now() - integrityStart;

      const anyIntegrityFail = integrityAssertions.some((a) => a.status === "FAIL");
      let integrityStatus: "PASS" | "WARN" | "FAIL" | "SKIP" = "PASS";
      if (anyIntegrityFail) integrityStatus = "FAIL";
      else if (integrityAssertions.some((a) => a.status === "WARN")) integrityStatus = "WARN";
      else if (integrityAssertions.every((a) => a.status === "SKIP")) integrityStatus = "SKIP";

      stages.push({
        key: "integrity",
        label: "Integrity",
        category: "reports",
        status: integrityStatus,
        durationMs: integrityDurationMs,
      });

      assertions.push(...integrityAssertions);
      log(`integrity stage complete: ${integrityAssertions.length} assertions`);
    } catch (err) {
      const integrityDurationMs = Date.now() - integrityStart;
      stages.push({
        key: "integrity",
        label: "Integrity",
        category: "reports",
        status: "FAIL",
        durationMs: integrityDurationMs,
        details: `integrity assertions failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      assertions.push({
        id: "R-INTEGRITY",
        category: "reports",
        status: "FAIL",
        blocking: true,
        message: "integrity assertions failed",
        evidence: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

  const mode: DiagnosticsMode = "reports";
  const result = createRunResult({
    mode,
    effectiveEnv,
    inferredEnv: effectiveEnv,
    dbHost,
    riskLevel: isConfigOnly ? "read-only" : "write",
    stages,
    assertions,
    sections: { reports: reportsSection },
  });

  // Fix durationMs and finishedAt
  (result as typeof result & { durationMs: number }).durationMs = durationMs;
  (result as typeof result & { finishedAt: string }).finishedAt = finishedAt;

  return result;
}
