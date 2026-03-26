// Diagnostics Framework Reports Section Types

// Re-export ReportsDiagnosticsSection from core for convenience
export type { ReportsDiagnosticsSection } from "../core/types";

/**
 * Inventory counts for reports data
 */
export interface ReportsInventory {
  items: number;
  tweets: number;
  dailyReports: number;
  weeklyReports: number;
}

/**
 * Options for running reports assertions
 */
export interface ReportsRunOptions {
  apiUrl: string;
  verbose?: boolean;
  dailyOnly?: boolean;
  weeklyOnly?: boolean;
  dailyPacks?: string[];
  maxItems?: number | null;
  pickCount?: number | null;
  timeout?: number;
  pollInterval?: number;
}

/**
 * API response wrapper used across the app
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Daily report data returned by GET /api/daily
 */
export interface DailyReportData {
  date: string | null;
  dayLabel: string | null;
  topicCount: number;
  errorMessage?: string | null;
  errorSteps?: string[] | null;
  topics: Array<{
    id: string;
    order: number;
    title: string;
    summary: string;
    itemIds: string[];
    tweetIds: string[];
  }>;
  referencedItems: Array<{ id: string; title: string; url: string; score: number; summary: string | null }>;
  referencedTweets: Array<{ id: string; text: string; authorHandle: string; tweetUrl: string }>;
}

/**
 * Weekly report data returned by GET /api/weekly
 */
export interface WeeklyReportData {
  weekNumber: string | null;
  editorial: string | null;
  errorMessage?: string | null;
  errorSteps?: string[] | null;
  picks: Array<{ id: string; order: number; itemId: string; reason: string }>;
  referencedItems: Array<{ id: string; title: string; url: string; score: number; summary: string | null }>;
}
