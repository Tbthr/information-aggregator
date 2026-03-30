// Diagnostics Framework Core Formatting

import type { DiagnosticsRunResult, DiagnosticsStatus } from "./types";

const STATUS_SYMBOLS: Record<DiagnosticsStatus, string> = {
  PASS: "✓",
  WARN: "⚠",
  FAIL: "✗",
  SKIP: "○",
};

const STATUS_COLORS: Record<DiagnosticsStatus, string> = {
  PASS: "\x1b[32m",  // green
  WARN: "\x1b[33m",  // yellow
  FAIL: "\x1b[31m",  // red
  SKIP: "\x1b[90m",  // gray
};

const RESET = "\x1b[0m";

/**
 * Formats a DiagnosticsRunResult for terminal display.
 * Returns a human-readable multi-line string with colored status.
 */
export function formatDiagnosticsRun(result: DiagnosticsRunResult): string {
  try {
    const { mode, status, durationMs, riskLevel, summary, stages, assertions } = result;

    const statusSymbol = STATUS_SYMBOLS[status] ?? "?";
    const statusColor = STATUS_COLORS[status] ?? "";

    const lines: string[] = [];

    // Header
    lines.push("");
    lines.push(`═══════════════════════════════════════════`);
    lines.push(`  DIAGNOSTICS  [${mode.toUpperCase()}]  ${statusColor}${statusSymbol} ${status}${RESET}`);
    lines.push(`═══════════════════════════════════════════`);
    lines.push(`  Duration : ${durationMs}ms`);
    lines.push(`  Risk     : ${riskLevel}`);
    lines.push(`  Env      : ${result.effectiveEnv} (inferred: ${result.inferredEnv})`);
    lines.push(`  DB Host  : ${result.dbHost}`);
    if (result.apiTarget) {
      lines.push(`  API      : ${result.apiTarget.url}`);
      if (result.apiTarget.reportedEnv) {
        lines.push(`  API Env  : ${result.apiTarget.reportedEnv}`);
      }
    }
    lines.push(`───────────────────────────────────────────`);

    // Summary
    lines.push(`  Summary  : ${summary.pass} pass  ${summary.warn} warn  ${summary.fail} fail  ${summary.skip} skip`);
    lines.push(`───────────────────────────────────────────`);

    // Stages
    if (stages.length > 0) {
      lines.push("  Stages:");
      for (const stage of stages) {
        const sym = STATUS_SYMBOLS[stage.status] ?? "?";
        const col = STATUS_COLORS[stage.status] ?? "";
        const depNote = stage.dependsOn?.length ? ` [deps: ${stage.dependsOn.join(", ")}]` : "";
        const blockNote = stage.blocking ? " [blocking]" : "";
        lines.push(`    ${col}${sym} ${stage.label}${RESET}${depNote}${blockNote} (${stage.durationMs}ms)`);
        if (stage.details) {
          lines.push(`           ${stage.details}`);
        }
      }
      lines.push(`───────────────────────────────────────────`);
    }

    // Assertions
    if (assertions.length > 0) {
      lines.push("  Assertions:");
      for (const a of assertions) {
        const sym = STATUS_SYMBOLS[a.status] ?? "?";
        const col = STATUS_COLORS[a.status] ?? "";
        const blockNote = a.blocking ? " [BLOCKING]" : "";
        lines.push(`    ${col}${sym} [${a.id}]${RESET} ${a.message}${blockNote}`);
      }
      lines.push(`───────────────────────────────────────────`);
    }

    // Sections summary
    if (result.sections) {
      if (result.sections.collection) {
        const col = result.sections.collection;
        lines.push("  Collection:");
        if (col.inventory) {
          lines.push(`    Content   : ${col.inventory.contentCount}`);
          lines.push(`    Sources   : ${col.inventory.sourceCount} (${col.inventory.unhealthySourceCount} unhealthy)`);
        }
        if (col.run) {
          lines.push(`    Run       : triggered=${col.run.triggered}`);
          lines.push(`    Raw items : ${col.run.counts.raw}`);
          lines.push(`    Deduped   : ${col.run.counts.afterNearDedup}`);
        }
      }
      if (result.sections.reports) {
        const rep = result.sections.reports;
        lines.push("  Reports:");
        if (rep.inventory) {
          lines.push(`    Content   : ${rep.inventory.contents}`);
          lines.push(`    Topics    : ${rep.inventory.topics}`);
          lines.push(`    Daily Rpts: ${rep.inventory.dailyReports}`);
          lines.push(`    Weekly Rpts: ${rep.inventory.weeklyReports}`);
        }
        if (rep.daily) {
          lines.push(`    Daily     : ${rep.daily.date ?? "n/a"} (${rep.daily.topicCount ?? 0} topics)`);
        }
        if (rep.weekly) {
          lines.push(`    Weekly    : ${rep.weekly.weekNumber ?? "n/a"} (${rep.weekly.pickCount ?? 0} picks)`);
        }
      }
    }

    lines.push("═══════════════════════════════════════════");
    lines.push("");

    return lines.join("\n");
  } catch {
    // Fallback formatting if anything goes wrong
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }
}

/**
 * Serializes a DiagnosticsRunResult to a JSON string.
 * Errors are caught so they don't crash the run.
 */
export function serializeDiagnosticsRun(result: DiagnosticsRunResult): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return "{}";
  }
}
