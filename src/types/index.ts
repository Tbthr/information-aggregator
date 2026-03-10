export type RunMode = "scan" | "digest";
export const CANONICAL_SOURCE_TYPES = [
  "rss",
  "json-feed",
  "website",
  "hn",
  "reddit",
  "opml_rss",
  "digest_feed",
  "custom_api",
  "github_trending",
  "x_home",
  "x_list",
  "x_bookmarks",
  "x_likes",
  "x_multi",
] as const;

export type SourceType = (typeof CANONICAL_SOURCE_TYPES)[number];
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
  description?: string;
  sourceIds: string[];
  referenceOnly?: boolean;
}

export interface TopicDefinition {
  id: string;
  name: string;
  keywords: string[];
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

export interface RawItemEngagement {
  score?: number;
  comments?: number;
  reactions?: number;
}

export interface RawItemCanonicalHints {
  externalUrl?: string;
  discussionUrl?: string;
  linkedUrl?: string;
  expandedUrl?: string;
}

export interface RawItemMetadata {
  provider: string;
  sourceType: SourceType;
  contentType: string;
  engagement?: RawItemEngagement;
  canonicalHints?: RawItemCanonicalHints;
  subreddit?: string;
  discoveredFrom?: string;
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
  metadataJson?: string;
  sourceType?: SourceType;
  contentType?: string;
  engagementScore?: number;
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
  lastFetchLatencyMs?: number | null;
  lastItemCount?: number | null;
  errorCount: number;
  consecutiveFailures?: number;
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
  contentType?: string;
  sourceType?: SourceType;
}

export function parseRawItemMetadata(metadataJson: string | undefined): RawItemMetadata | null {
  if (typeof metadataJson !== "string" || metadataJson.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson) as RawItemMetadata | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
