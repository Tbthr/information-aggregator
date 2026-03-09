export type RunMode = "scan" | "digest";

export interface Source {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  url?: string;
  configJson?: string;
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
}

export interface Cluster {
  id: string;
  canonicalItemId: string;
  memberItemIds: string[];
  dedupeMethod: "exact" | "near";
}

export interface RunRecord {
  id: string;
  mode: RunMode;
  startedAt: string;
  finishedAt?: string;
  status: "pending" | "running" | "completed" | "failed";
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
