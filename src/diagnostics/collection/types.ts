// Diagnostics Framework Collection Section Types

/**
 * Source health classification
 */
export type SourceHealthStatus = "healthy" | "warning" | "failing" | "unknown";

/**
 * Summary counts from the collection pipeline
 */
export interface RunCounts {
  raw: number;
  normalized: number;
  afterExactDedup: number;
  afterNearDedup: number;
  archivedNew?: number;
  archivedUpdated?: number;
}

/**
 * Single source event during a collection run
 */
export interface SourceEvent {
  sourceId: string;
  status: "success" | "failure" | "zero-items";
  itemCount: number;
  latencyMs?: number;
  error?: string;
}

/**
 * Source health summary from database
 */
export interface SourceHealthSummary {
  sourceId: string;
  sourceName: string;
  status: SourceHealthStatus;
  consecutiveFailures: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
}

/**
 * Collection inventory statistics
 */
export interface CollectionInventory {
  contentCount: number;
  sourceCount: number;
  unhealthySourceCount: number;
}

/**
 * Persisted summary content (from database)
 */
export interface PersistedContentSummary {
  id: string;
  kind: string;
  title?: string | null;
  url: string;
  authorLabel?: string | null;
  publishedAt?: string | null;
  qualityScore?: number | null;
}

/**
 * Persisted summary built from archived content in the database
 */
export interface PersistedSummary {
  topContent: PersistedContentSummary[];
}

/**
 * Run candidate item (from this run's candidate pool)
 */
export interface RunCandidateItem {
  title: string;
  sourceId: string;
  sourceName?: string;
  canonicalUrl?: string;
}

/**
 * Summary of candidates from a collection run
 */
export interface RunCandidateSummary {
  level: "normalized" | "afterExactDedup" | "afterNearDedup";
  topItems: RunCandidateItem[];
}

/**
 * The full collection diagnostics section
 */
export interface CollectionDiagnosticsSection {
  inventory?: CollectionInventory;
  health?: SourceHealthSummary[];
  run?: {
    triggered: boolean;
    sourceEvents: SourceEvent[];
    counts: RunCounts;
  };
  persistedSummary?: PersistedSummary;
  runCandidateSummary?: RunCandidateSummary;
}
