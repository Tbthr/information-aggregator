export type RunMode = "scan" | "digest";
export type SourceType = "rss" | "json-feed" | "website" | string;
export type RunStatus = "pending" | "running" | "completed" | "failed" | "succeeded";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  enabled: boolean;
  url?: string;
  configJson?: string;
  weight?: number;
}

export interface SourcePack {
  id: string;
  name: string;
  sourceIds: string[];
}

export interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  fetchedAt: string;
  metadataJson: string;
  snippet?: string;
  publishedAt?: string;
  author?: string;
}

export interface NormalizedItem {
  id: string;
  rawItemId: string;
  canonicalUrl: string;
  normalizedTitle: string;
  normalizedSnippet?: string;
  normalizedText?: string;
  exactDedupKey?: string;
  processedAt?: string;
  sourceId?: string;
  title?: string;
  url?: string;
}

export interface Cluster {
  id: string;
  canonicalItemId: string;
  memberItemIds: string[];
  dedupeMethod: "exact" | "near";
  runId?: string;
  title?: string;
  summary?: string;
  url?: string;
}

export interface RunRecord {
  id: string;
  mode: RunMode;
  startedAt?: string;
  createdAt?: string;
  finishedAt?: string;
  status: RunStatus;
  sourceSelectionJson?: string;
  paramsJson?: string;
}

export interface OutputRecord {
  id: string;
  runId: string;
  mode: RunMode;
  format: "markdown" | "json";
  body: string;
  createdAt: string;
}

export interface TopicProfile {
  id: string;
  name: string;
  mode: RunMode;
  topicIds: string[];
  sourcePackIds?: string[];
}

export interface SourceHealth {
  sourceId: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastError?: string | null;
  errorCount: number;
  consecutiveZeroItemRuns: number;
}

export interface TopicRule {
  includeKeywords?: string[];
  excludeKeywords?: string[];
  preferredSources?: string[];
  blockedSources?: string[];
}

export interface RankedCandidate {
  id: string;
  title?: string;
  url?: string;
  sourceId?: string;
  sourceName?: string;
  normalizedTitle?: string;
  normalizedText?: string;
  canonicalUrl?: string;
  processedAt?: string;
  sourceWeightScore: number;
  freshnessScore: number;
  engagementScore: number;
  topicMatchScore: number;
  contentQualityAi: number;
  finalScore?: number;
  rationale?: string;
}
