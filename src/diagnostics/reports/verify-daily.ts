// Diagnostics Framework Reports Daily Verification
// Migrated from scripts/verify-reports-pipeline.ts Stage 5, 6, D-17, G-05
//
// Compatibility: The daily report now uses the runtime scoring pipeline
// (ReportCandidate + ScoredCandidate), but the output shape is unchanged:
//   - DailyOverview.topicCount matches DigestTopic count
//   - DigestTopic.itemIds and DigestTopic.tweetIds are retained (FK-compatible)
//   - Item/Tweet records referenced by those IDs still have all required fields
//
// These diagnostics verify the output contract that weekly depends on.

import { prisma } from "@/lib/prisma";
import { formatUtcDate } from "@/lib/date-utils";
import type { DiagnosticsAssertion } from "../core/types";
import type { ReportsRunOptions, DailyReportData, ApiResponse } from "./types";

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
 * Runs daily report assertions:
 * - Triggers and verifies daily report generation (Stage 5+6)
 * - D-17: Empty daily API behavior
 * - G-05: Daily latest API behavior
 */
export async function runDailyAssertions(
  options: ReportsRunOptions
): Promise<DiagnosticsAssertion[]> {
  const { apiUrl, verbose, dailyOnly, weeklyOnly, timeout = 300, pollInterval = 3 } = options;
  const assertions: DiagnosticsAssertion[] = [];
  const verboseLog = (...args: string[]) => {
    if (verbose) console.log(...args);
  };

  // ── Stage 5: Trigger Daily Report ──────────────────────────

  if (!weeklyOnly) {
    const stage5Start = Date.now();

    // Check if 24h items exist
    const now24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentItemCount = await prisma.item.count({ where: { publishedAt: { gte: now24hAgo } } });

    if (recentItemCount === 0) {
      verboseLog("  [SKIP] No items in the past 24 hours");
      assertions.push({
        id: "reports.stage5",
        category: "reports",
        status: "SKIP",
        blocking: false,
        message: "no items in past 24h",
        evidence: { itemCount: 0 },
      });
      // stage6 depends on stage5 — skip when there's nothing to verify
      assertions.push({
        id: "reports.stage6",
        category: "reports",
        status: "SKIP",
        blocking: false,
        message: "stage5 skipped: no recent items to generate report",
        evidence: { stage5Skipped: true },
      });
    } else {
      verboseLog(`  Found ${recentItemCount} items in the past 24 hours`);

      const res = await fetch(`${apiUrl}/api/cron/daily`, { method: "POST" });
      if (!res.ok) {
        assertions.push({
          id: "reports.stage5",
          category: "reports",
          status: "FAIL",
          blocking: true,
          message: `POST /api/cron/daily returned ${res.status}`,
          evidence: { status: res.status },
        });
        // stage6 cannot run if stage5 failed to trigger
        assertions.push({
          id: "reports.stage6",
          category: "reports",
          status: "SKIP",
          blocking: false,
          message: "stage5 failed: cannot verify",
          evidence: { stage5Failed: true },
        });
      } else {
        // Compute target date
        const targetDate = formatUtcDate(new Date());
        verboseLog(`  Target date: ${targetDate}`);

        // Poll for DailyOverview
        let stage5Passed = false;
        try {
          await pollUntil(
            () => prisma.dailyOverview.findUnique({ where: { date: targetDate } }),
            (overview) => overview !== null,
            { timeout, interval: pollInterval, stageName: "Daily report generation" }
          );

          verboseLog(`  [OK] DailyOverview created for ${targetDate}`);
          assertions.push({
            id: "reports.stage5",
            category: "reports",
            status: "PASS",
            blocking: false,
            message: `generated for ${targetDate}`,
            evidence: { date: targetDate, itemCount: recentItemCount },
          });
          stage5Passed = true;
        } catch (err) {
          assertions.push({
            id: "reports.stage5",
            category: "reports",
            status: "FAIL",
            blocking: true,
            message: "generation timed out",
            evidence: { error: err instanceof Error ? err.message : String(err) },
          });
        }

        // ── Stage 6: Verify Daily Report ──────────────────────────
        // Only run if stage5 successfully triggered report generation

        if (stage5Passed) {
          const stage6Start = Date.now();

          // --- API check ---
          const apiRes = await fetch(`${apiUrl}/api/daily?date=${targetDate}`);
          if (!apiRes.ok) {
            assertions.push({
              id: "reports.stage6",
              category: "reports",
              status: "FAIL",
              blocking: true,
              message: `GET /api/daily returned ${apiRes.status}`,
              evidence: { status: apiRes.status },
            });
          } else {
            const apiBody: ApiResponse<DailyReportData> = await apiRes.json();
            if (!apiBody.success || !apiBody.data) {
              assertions.push({
                id: "reports.stage6",
                category: "reports",
                status: "FAIL",
                blocking: true,
                message: `API response unsuccessful`,
                evidence: { success: apiBody.success },
              });
            } else {
              const dailyData = apiBody.data;
              verboseLog(`  API check: date=${dailyData.date}, topics=${dailyData.topics.length}`);

              if (dailyData.topics.length === 0) {
                assertions.push({
                  id: "reports.stage6",
                  category: "reports",
                  status: "FAIL",
                  blocking: true,
                  message: "empty report: no topics",
                  evidence: { topicCount: 0 },
                });
              } else {
                // --- DB check ---
                const overview = await prisma.dailyOverview.findUnique({
                  where: { date: targetDate },
                  include: { topics: { orderBy: { order: "asc" } } },
                });

                if (!overview) {
                  assertions.push({
                    id: "reports.stage6",
                    category: "reports",
                    status: "FAIL",
                    blocking: true,
                    message: `DailyOverview not found for ${targetDate}`,
                    evidence: { date: targetDate },
                  });
                } else {
                  const errors: string[] = [];

                  // Validate topicCount
                  if (overview.topicCount !== overview.topics.length) {
                    errors.push(`topicCount mismatch: stored=${overview.topicCount}, actual=${overview.topics.length}`);
                  }

                  // Validate topics
                  for (const topic of overview.topics) {
                    if (!topic.title || topic.title.trim() === "") {
                      errors.push(`topic ${topic.id}: empty title`);
                    }
                    if (!topic.summary || topic.summary.trim() === "") {
                      errors.push(`topic ${topic.id}: empty summary`);
                    }
                    if (topic.itemIds.length === 0 && topic.tweetIds.length === 0) {
                      errors.push(`topic ${topic.id}: no itemIds or tweetIds`);
                    }
                  }

                  // Full reference integrity: check ALL itemIds
                  const allItemIds = new Set<string>();
                  const allTweetIds = new Set<string>();
                  for (const topic of overview.topics) {
                    for (const id of topic.itemIds) allItemIds.add(id);
                    for (const id of topic.tweetIds) allTweetIds.add(id);
                  }

                  if (allItemIds.size > 0) {
                    const existingItemCount = await prisma.item.count({
                      where: { id: { in: Array.from(allItemIds) } },
                    });
                    const missingItemCount = allItemIds.size - existingItemCount;
                    if (missingItemCount > 0) {
                      errors.push(`FK integrity: ${missingItemCount}/${allItemIds.size} itemIds not found`);
                    }
                  }

                  if (allTweetIds.size > 0) {
                    const existingTweetCount = await prisma.tweet.count({
                      where: { id: { in: Array.from(allTweetIds) } },
                    });
                    const missingTweetCount = allTweetIds.size - existingTweetCount;
                    if (missingTweetCount > 0) {
                      errors.push(`FK integrity: ${missingTweetCount}/${allTweetIds.size} tweetIds not found`);
                    }
                  }

                  assertions.push({
                    id: "reports.stage6",
                    category: "reports",
                    status: errors.length === 0 ? "PASS" : "FAIL",
                    blocking: true,
                    message:
                      errors.length === 0
                        ? `${overview.topics.length} topics verified`
                        : `${errors.length} error(s): ${errors.join("; ")}`,
                    evidence: { topicCount: overview.topics.length, errors },
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // ── D-17: Empty daily API (non-existent date) ─────────────

  const d17Start = Date.now();
  const { status: d17Status, body: d17Body } = await apiGet<DailyReportData>(
    `${apiUrl}/api/daily?date=2099-01-01`
  );
  const d17Ok = d17Status === 200 && d17Body.success === true && d17Body.data?.topics?.length === 0;
  verboseLog(`  D-17 empty date: status=${d17Status}, success=${d17Body.success}, topics=${d17Body.data?.topics?.length}`);

  assertions.push({
    id: "D-17",
    category: "api",
    status: d17Ok ? "PASS" : "FAIL",
    blocking: false,
    message: d17Ok ? "returns 200 with empty arrays for non-existent date" : `unexpected response (status=${d17Status})`,
    evidence: { status: d17Status, success: d17Body.success, topicCount: d17Body.data?.topics?.length ?? -1 },
  });

  // ── G-05: GET daily without date (latest) ─────────────────

  const g05Start = Date.now();
  const { status: g05Status, body: g05Body } = await apiGet<DailyReportData>(`${apiUrl}/api/daily`);
  const g05Ok = g05Status === 200 && g05Body.success === true;
  verboseLog(`  G-05 GET /api/daily (no date): status=${g05Status}, date=${g05Body.data?.date}`);

  assertions.push({
    id: "G-05",
    category: "api",
    status: g05Ok ? "PASS" : "FAIL",
    blocking: false,
    message: g05Ok ? `returns latest (date=${g05Body.data?.date})` : `unexpected response (status=${g05Status})`,
    evidence: { status: g05Status, date: g05Body.data?.date ?? null },
  });

  return assertions;
}

/** GET helper */
async function apiGet<T = unknown>(url: string): Promise<{ status: number; body: ApiResponse<T> }> {
  const res = await fetch(url);
  const body: ApiResponse<T> = await res.json();
  return { status: res.status, body };
}
