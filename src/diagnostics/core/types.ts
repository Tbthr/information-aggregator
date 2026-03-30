// Diagnostics Framework Core Types

export type DiagnosticsMode = "collection" | "reports" | "full";

export type DiagnosticsStatus = "PASS" | "WARN" | "FAIL" | "SKIP";

export type DiagnosticsRiskLevel = "read-only" | "write" | "high-risk-write";

export type DiagnosticsEnv = "test" | "production";

export interface DiagnosticsRunResult {
  mode: DiagnosticsMode;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  effectiveEnv: DiagnosticsEnv;
  inferredEnv: DiagnosticsEnv | "unknown";
  dbHost: string;
  apiTarget?: {
    url: string;
    reportedEnv?: DiagnosticsEnv | "unknown";
    reportedDbHost?: string;
  };
  riskLevel: DiagnosticsRiskLevel;
  status: DiagnosticsStatus;
  summary: {
    pass: number;
    warn: number;
    fail: number;
    skip: number;
  };
  stages: DiagnosticsStageResult[];
  assertions: DiagnosticsAssertion[];
  sections?: {
    collection?: CollectionDiagnosticsSection;
    reports?: ReportsDiagnosticsSection;
  };
}

export interface DiagnosticsStageResult {
  key: string;
  label: string;
  category: "collection" | "reports" | "system";
  status: DiagnosticsStatus;
  durationMs: number;
  blocking?: boolean;
  dependsOn?: string[];
  details?: string;
  data?: Record<string, unknown>;
}

export interface DiagnosticsAssertion {
  id: string;
  category: "collection" | "reports" | "system" | "api";
  status: DiagnosticsStatus;
  blocking: boolean;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface CollectionDiagnosticsSection {
  inventory?: {
    contentCount: number;
    sourceCount: number;
    unhealthySourceCount: number;
  };
  health?: Array<{
    sourceId: string;
    sourceName: string;
    status: "healthy" | "warning" | "failing" | "unknown";
    consecutiveFailures: number;
    lastSuccessAt?: string;
    lastFailureAt?: string;
    lastError?: string;
  }>;
  run?: {
    triggered: boolean;
    sourceEvents: Array<{
      sourceId: string;
      status: "success" | "failure" | "zero-items";
      itemCount: number;
      latencyMs?: number;
      error?: string;
    }>;
    counts: {
      raw: number;
      normalized: number;
      afterExactDedup: number;
      afterNearDedup: number;
      archivedNew?: number;
      archivedUpdated?: number;
    };
  };
  persistedSummary?: {
    topContent: Array<{
      id: string;
      kind: string;
      title?: string | null;
      url: string;
      authorLabel?: string | null;
      publishedAt?: string | null;
      qualityScore?: number | null;
    }>;
  };
  runCandidateSummary?: {
    level: "normalized" | "afterExactDedup" | "afterNearDedup";
    topItems: Array<{
      title: string;
      sourceId: string;
      sourceName?: string;
      canonicalUrl?: string;
    }>;
  };
}

export interface ReportsDiagnosticsSection {
  config?: {
    daily: Record<string, unknown>;
    weekly: Record<string, unknown>;
  };
  inventory?: {
    contents: number;
    dailyReports: number;
    weeklyReports: number;
    topics: number;
  };
  resolvedTargets?: {
    dailyDate?: string;
    weeklyWeekNumber?: string;
  };
  daily?: {
    date?: string;
    topicCount?: number;
  };
  weekly?: {
    weekNumber?: string;
    pickCount?: number;
  };
}

// Argument types for CLI
export interface DiagnosticsArgs {
  mode: DiagnosticsMode;
  runCollection?: boolean;
  configOnly?: boolean;
  dailyOnly?: boolean;
  weeklyOnly?: boolean;
  cleanup?: boolean;
  allowWrite?: boolean;
  confirmProduction?: boolean;
  confirmCleanup?: boolean;
  apiUrl?: string;
  jsonOutput?: string;
  verbose?: boolean;
}

export interface NormalizeResult {
  ok: boolean;
  error?: string;
  args?: DiagnosticsArgs;
}
