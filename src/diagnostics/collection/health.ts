// Diagnostics Framework Collection Health

import { prisma } from "@/lib/prisma";
import type { SourceHealthSummary, SourceHealthStatus } from "./types";
export type { SourceHealthSummary } from "./types";

/**
 * Classification thresholds
 */
const WARNING_THRESHOLD_HOURS = 6;
const FAILING_THRESHOLD_HOURS = 24;
const FAILING_MIN_CONSECUTIVE = 3;

/**
 * Loads all source health records from the database and joins with source names.
 * Returns an array of source health details ready for diagnostics.
 */
export async function loadSourceHealthSummary(): Promise<SourceHealthSummary[]> {
  const records = await prisma.sourceHealth.findMany({
    include: {
      source: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return records.map((record) => {
    const detail: SourceHealthSummary = {
      sourceId: record.sourceId,
      sourceName: record.source.name,
      status: "healthy" as SourceHealthStatus,
      consecutiveFailures: record.consecutiveFailures,
      lastSuccessAt: record.lastSuccessAt?.toISOString(),
      lastFailureAt: record.lastFailureAt?.toISOString(),
      lastError: record.lastError ?? undefined,
    };
    return {
      ...detail,
      status: classifySourceHealth(detail),
    };
  });
}

/**
 * Classifies a source health detail into a health status.
 *
 * Logic:
 * - healthy: consecutiveFailures = 0 OR (has recent success OR lastFailureAt is older than lastSuccessAt)
 * - warning: consecutiveFailures > 0 BUT last success within WARNING_THRESHOLD_HOURS
 * - failing: consecutiveFailures >= FAILING_MIN_CONSECUTIVE AND no recent success
 * - unknown: never been checked
 */
export function classifySourceHealth(detail: SourceHealthSummary): SourceHealthStatus {
  const { consecutiveFailures, lastSuccessAt, lastFailureAt } = detail;

  // If never checked (no success AND no failure), return unknown
  if (!lastSuccessAt && !lastFailureAt) {
    return "unknown";
  }

  // No failures recorded — definitely healthy
  if (consecutiveFailures === 0) {
    return "healthy";
  }

  // All timestamps are UTC ISO strings from database (via toISOString())
  const nowMs = Date.now();

  // Compute time since last success (if any) - both values are UTC ms
  const msSinceSuccess = lastSuccessAt ? nowMs - new Date(lastSuccessAt).getTime() : Infinity;
  const successHoursAgo = msSinceSuccess / (1000 * 60 * 60);

  // Compute time since last failure (if any) - both values are UTC ms
  const msSinceFailure = lastFailureAt ? nowMs - new Date(lastFailureAt).getTime() : Infinity;
  const failureHoursAgo = msSinceFailure / (1000 * 60 * 60);

  // If last success is more recent than last failure, recent enough = warning level
  if (lastSuccessAt && lastFailureAt) {
    if (msSinceSuccess < msSinceFailure) {
      // Success is more recent — if within warning window, status is warning
      if (successHoursAgo < WARNING_THRESHOLD_HOURS) {
        return "warning";
      }
      // Success is older but still more recent than failure — treat as healthy
      return "healthy";
    }
  }

  // No success ever, or failure is more recent
  if (consecutiveFailures >= FAILING_MIN_CONSECUTIVE && failureHoursAgo < FAILING_THRESHOLD_HOURS) {
    return "failing";
  }

  if (consecutiveFailures > 0 && failureHoursAgo < WARNING_THRESHOLD_HOURS) {
    return "warning";
  }

  return "failing";
}
