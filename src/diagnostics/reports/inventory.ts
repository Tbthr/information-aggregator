// Diagnostics Framework Reports Inventory

import { prisma } from "@/lib/prisma";
import { beijingDayRange, beijingWeekRange, utcWeekNumber, formatUtcDate } from "@/lib/date-utils";
import type { ReportsInventory } from "./types";

/**
 * Loads reports inventory counts from the database.
 * Content is counted for the last 24 hours.
 */
export async function loadReportsInventory(): Promise<ReportsInventory> {
  const now24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [contents, dailyReports, weeklyReports, topics] = await Promise.all([
    prisma.content.count({ where: { fetchedAt: { gte: now24hAgo } } }),
    prisma.dailyOverview.count(),
    prisma.weeklyReport.count(),
    prisma.digestTopic.count(),
  ]);

  return { contents, dailyReports, weeklyReports, topics };
}

/**
 * Resolves the target date and week number for daily and weekly reports
 * using Beijing time (UTC+8) boundaries.
 */
export function resolveReportsTargets(): { dailyDate: string; weeklyWeekNumber: string } {
  const today = new Date();

  // Resolve daily date: format as YYYY-MM-DD in Beijing time
  // beijingDayRange returns the UTC range for a Beijing date
  const { start: dayStart } = beijingDayRange(formatUtcDate(today));
  const dailyDate = formatUtcDate(dayStart);

  // Resolve weekly week number
  const { start: weekStart } = beijingWeekRange(today);
  const weeklyWeekNumber = utcWeekNumber(weekStart);

  return { dailyDate, weeklyWeekNumber };
}
