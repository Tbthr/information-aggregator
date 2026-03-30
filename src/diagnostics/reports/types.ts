// Diagnostics Framework Reports Section Types

// Re-export ReportsDiagnosticsSection from core for convenience
export type { ReportsDiagnosticsSection } from "../core/types";

/**
 * Inventory counts for reports data
 */
export interface ReportsInventory {
  contents: number;
  dailyReports: number;
  weeklyReports: number;
  topics: number;
}

/**
 * Options for running reports assertions
 */
export interface ReportsRunOptions {
  apiUrl: string;
  verbose?: boolean;
  dailyOnly?: boolean;
  weeklyOnly?: boolean;
  dailyTopicIds?: string[];
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
    contentIds: string[];
  }>;
  contents: Array<{
    id: string;
    kind: string;
    sourceId: string;
    title?: string | null;
    body?: string | null;
    url: string;
    authorLabel?: string | null;
    publishedAt?: string | null;
    fetchedAt: string;
    engagementScore?: number | null;
    qualityScore?: number | null;
    topicIds: string[];
    topicScoresJson?: string | null;
    metadataJson?: string | null;
  }>;
}

/**
 * Weekly report data returned by GET /api/weekly
 */
export interface WeeklyReportData {
  weekNumber: string | null;
  editorial: string | null;
  errorMessage?: string | null;
  errorSteps?: string[] | null;
  picks: Array<{ id: string; order: number; contentId: string | null; reason: string }>;
  contents: Array<{
    id: string;
    kind: string;
    sourceId: string;
    title?: string | null;
    body?: string | null;
    url: string;
    authorLabel?: string | null;
    publishedAt?: string | null;
    fetchedAt: string;
    engagementScore?: number | null;
    qualityScore?: number | null;
    topicIds: string[];
    topicScoresJson?: string | null;
    metadataJson?: string | null;
  }>;
}
