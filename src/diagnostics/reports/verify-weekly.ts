// Diagnostics Framework Reports Weekly Verification
// Migrated from scripts/verify-reports-pipeline.ts Stage 7, 8, E-10, G-06
//
// Content model: Weekly report reads from DailyOverview (via DigestTopic.contentIds).
// WeeklyPick.contentId references Content records (new model).
// WeeklyPick.itemId is legacy and retained for migration.
//
// These diagnostics verify:
//   - Weekly report generation produces valid WeeklyReport + WeeklyPicks
//   - Weekly picks reference valid Content IDs (FK integrity)
//   - API endpoints return correct shape for empty and latest queries

import { prisma } from "@/lib/prisma";
import { beijingWeekRange, utcWeekNumber } from "@/lib/date-utils";
import type { DiagnosticsAssertion } from "../core/types";
import type { ReportsRunOptions, WeeklyReportData, ApiResponse } from "./types";

/**
 * Poll until checkFn returns true, throw on timeout.
 */
async function pollUntil<T>(
  fetchFn: () => Promise<T>,
  checkFn: (value: T) => boolean,
  options: { timeout: number; interval: number; stageName: string }
): Promise<T> {
  const start = Date.now();
  const timeoutMs = options.timeout * 1000;
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fetchFn();
      if (checkFn(value)) return value;
    } catch {
      // fetchFn itself can throw on transient errors, just retry
    }
    await new Promise((r) => setTimeout(r, options.interval * 1000));
  }
  throw new Error(`${options.stageName} timed out after ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

/**
 * Runs weekly report assertions:
 * - Triggers and verifies weekly report generation (Stage 7+8)
 * - E-10: Empty weekly API behavior
 * - G-06: Weekly latest API behavior
 */
export async function runWeeklyAssertions(
  options: ReportsRunOptions
): Promise<DiagnosticsAssertion[]> {
  const { apiUrl, verbose, dailyOnly, timeout = 300, pollInterval = 3 } = options;
  const assertions: DiagnosticsAssertion[] = [];
  const verboseLog = (...args: string[]) => {
    if (verbose) console.log(...args);
  };

  // ── Stage 7: Trigger Weekly Report ────────────────────────

  if (!dailyOnly) {
    const stage7Start = Date.now();

    // Check if we have any DailyOverview records
    const dailyCount = await prisma.dailyOverview.count();
    verboseLog(`  Found ${dailyCount} DailyOverview records`);

    const res = await fetch(`${apiUrl}/api/cron/weekly`, { method: "POST" });
    if (!res.ok) {
      assertions.push({
        id: "reports.stage7",
        category: "reports",
        status: "FAIL",
        blocking: true,
        message: `POST /api/cron/weekly returned ${res.status}`,
        evidence: { status: res.status },
      });
    } else {
      // Compute week number
      const { start: monday } = beijingWeekRange(new Date());
      const weekNumber = utcWeekNumber(monday);
      verboseLog(`  Target week: ${weekNumber}`);

      // Poll for WeeklyReport
      try {
        await pollUntil(
          () => prisma.weeklyReport.findUnique({ where: { weekNumber } }),
          (report) => report !== null,
          { timeout, interval: pollInterval, stageName: "Weekly report generation" }
        );

        verboseLog(`  [OK] WeeklyReport created for ${weekNumber}`);
        assertions.push({
          id: "reports.stage7",
          category: "reports",
          status: "PASS",
          blocking: false,
          message: `generated for ${weekNumber}`,
          evidence: { weekNumber, dailyCount },
        });
      } catch (err) {
        assertions.push({
          id: "reports.stage7",
          category: "reports",
          status: "FAIL",
          blocking: true,
          message: "generation timed out",
          evidence: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    // ── Stage 8: Verify Weekly Report ─────────────────────────

    const stage8Start = Date.now();

    // Compute week number
    const { start: monday } = beijingWeekRange(new Date());
    const weekNumber = utcWeekNumber(monday);
    verboseLog(`  Target week: ${weekNumber}`);

    // --- API check ---
    const apiRes = await fetch(`${apiUrl}/api/weekly?week=${weekNumber}`);
    if (!apiRes.ok) {
      assertions.push({
        id: "reports.stage8",
        category: "reports",
        status: "FAIL",
        blocking: true,
        message: `GET /api/weekly returned ${apiRes.status}`,
        evidence: { status: apiRes.status },
      });
    } else {
      const apiBody: ApiResponse<WeeklyReportData> = await apiRes.json();
      if (!apiBody.success || !apiBody.data) {
        assertions.push({
          id: "reports.stage8",
          category: "reports",
          status: "FAIL",
          blocking: true,
          message: `API response unsuccessful`,
          evidence: { success: apiBody.success },
        });
      } else {
        const weeklyData = apiBody.data;
        verboseLog(`  API check: weekNumber=${weeklyData.weekNumber}, picks=${weeklyData.picks.length}`);

        // --- DB check ---
        const report = await prisma.weeklyReport.findUnique({
          where: { weekNumber },
          include: { picks: { orderBy: { order: "asc" } } },
        });

        if (!report) {
          assertions.push({
            id: "reports.stage8",
            category: "reports",
            status: "FAIL",
            blocking: true,
            message: `WeeklyReport not found for ${weekNumber}`,
            evidence: { weekNumber },
          });
        } else {
          const errors: string[] = [];

          // Validate editorial
          if (!report.editorial || report.editorial.trim() === "") {
            errors.push("editorial is empty");
          }

          // Validate picks
          for (const pick of report.picks) {
            if (!pick.contentId) {
              errors.push(`pick ${pick.id}: no contentId`);
            }
            if (!pick.reason || pick.reason.trim() === "") {
              errors.push(`pick ${pick.id}: empty reason`);
            }
          }

          // Full reference integrity: check ALL contentIds
          const contentIdSet = new Set<string>(
            report.picks.map((p) => p.contentId).filter((id): id is string => id !== null)
          );
          if (contentIdSet.size > 0) {
            const existingContentCount = await prisma.content.count({
              where: { id: { in: Array.from(contentIdSet) } },
            });
            const missingCount = contentIdSet.size - existingContentCount;
            if (missingCount > 0) {
              errors.push(`FK integrity: ${missingCount}/${contentIdSet.size} contentIds not found`);
            }
          }

          assertions.push({
            id: "reports.stage8",
            category: "reports",
            status: errors.length === 0 ? "PASS" : "FAIL",
            blocking: true,
            message:
              errors.length === 0
                ? `${report.picks.length} picks, editorial=${report.editorial?.length ?? 0} chars`
                : `${errors.length} error(s): ${errors.join("; ")}`,
            evidence: { pickCount: report.picks.length, editorialLength: report.editorial?.length ?? 0, errors },
          });
        }
      }
    }
  }

  // ── E-10: Empty weekly API (non-existent week) ───────────

  const e10Res = await apiGet<WeeklyReportData>(`${apiUrl}/api/weekly?week=2099-W01`);
  const e10Ok =
    e10Res.status === 200 &&
    e10Res.body.success === true &&
    e10Res.body.data?.picks?.length === 0 &&
    e10Res.body.data?.editorial === null;
  verboseLog(
    `  E-10 empty week: status=${e10Res.status}, success=${e10Res.body.success}, editorial=${e10Res.body.data?.editorial}`
  );

  assertions.push({
    id: "E-10",
    category: "api",
    status: e10Ok ? "PASS" : "FAIL",
    blocking: false,
    message: e10Ok ? "returns 200 with empty data for non-existent week" : `unexpected response (status=${e10Res.status})`,
    evidence: {
      status: e10Res.status,
      success: e10Res.body.success,
      editorial: e10Res.body.data?.editorial ?? null,
      pickCount: e10Res.body.data?.picks?.length ?? -1,
    },
  });

  // ── G-06: GET weekly without week (latest) ─────────────

  const g06Res = await apiGet<WeeklyReportData>(`${apiUrl}/api/weekly`);
  const g06Ok = g06Res.status === 200 && g06Res.body.success === true;
  verboseLog(`  G-06 GET /api/weekly (no week): status=${g06Res.status}, week=${g06Res.body.data?.weekNumber}`);

  assertions.push({
    id: "G-06",
    category: "api",
    status: g06Ok ? "PASS" : "FAIL",
    blocking: false,
    message: g06Ok ? `returns latest (week=${g06Res.body.data?.weekNumber})` : `unexpected response (status=${g06Res.status})`,
    evidence: { status: g06Res.status, weekNumber: g06Res.body.data?.weekNumber ?? null },
  });

  return assertions;
}

/** GET helper */
async function apiGet<T = unknown>(url: string): Promise<{ status: number; body: ApiResponse<T> }> {
  const res = await fetch(url);
  const body: ApiResponse<T> = await res.json();
  return { status: res.status, body };
}
