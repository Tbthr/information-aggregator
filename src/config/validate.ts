import type { Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid source field: ${field}`);
  }

  return value;
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`Invalid field: ${field}`);
  }

  return value;
}

export function validateSource(input: unknown): Source {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid source entry");
  }

  const record = input as Record<string, unknown>;

  if (typeof record.enabled !== "boolean") {
    throw new Error("Invalid source field: enabled");
  }

  return {
    id: assertString(record.id, "id"),
    name: assertString(record.name, "name"),
    type: assertString(record.type, "type"),
    enabled: record.enabled,
    url: typeof record.url === "string" ? record.url : undefined,
    configJson: JSON.stringify(record.config ?? {}),
  };
}

export function validateTopic(input: unknown): TopicDefinition {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid topic entry");
  }

  const record = input as Record<string, unknown>;

  return {
    id: assertString(record.id, "topic.id"),
    name: assertString(record.name, "topic.name"),
    keywords: assertStringArray(record.keywords, "topic.keywords"),
  };
}

export function validateProfile(input: unknown): TopicProfile {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid profile entry");
  }

  const record = input as Record<string, unknown>;

  return {
    id: assertString(record.id, "profile.id"),
    name: assertString(record.name, "profile.name"),
    mode: assertString(record.mode, "profile.mode") as TopicProfile["mode"],
    topicIds: assertStringArray(record.topicIds, "profile.topicIds"),
    sourcePackIds: Array.isArray(record.sourcePackIds) ? assertStringArray(record.sourcePackIds, "profile.sourcePackIds") : undefined,
  };
}

export function validateSourcePack(input: unknown): SourcePack {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid source pack entry");
  }

  const record = input as Record<string, unknown>;

  return {
    id: assertString(record.id, "pack.id"),
    name: assertString(record.name, "pack.name"),
    sourceIds: assertStringArray(record.sourceIds, "pack.sourceIds"),
  };
}
