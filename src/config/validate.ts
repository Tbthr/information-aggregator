import { CANONICAL_SOURCE_TYPES, type Source, type SourcePack, type SourceType, type TopicDefinition, type TopicProfile } from "../types/index";

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

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid field: ${field}`);
  }

  return value;
}

function assertRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid field: ${field}`);
  }

  return value as Record<string, unknown>;
}

function assertSourceType(value: unknown): SourceType {
  if (typeof value !== "string" || !CANONICAL_SOURCE_TYPES.includes(value as SourceType)) {
    throw new Error(`Invalid source field: type`);
  }

  return value as SourceType;
}

function isSchemaPlaceholder(config: Record<string, unknown>): boolean {
  return config.placeholderMode === "schema";
}

function hasNonEmptyString(record: Record<string, unknown>, field: string): boolean {
  return typeof record[field] === "string" && record[field].trim() !== "";
}

function validateCustomApiFieldMap(sourceId: string, type: SourceType, config: Record<string, unknown>): void {
  if (!hasNonEmptyString(config, "itemPath")) {
    throw new Error(`Source ${sourceId} (${type}) requires config.itemPath`);
  }

  const fieldMap = config.fieldMap;
  if (!fieldMap || typeof fieldMap !== "object" || Array.isArray(fieldMap)) {
    throw new Error(`Source ${sourceId} (${type}) requires config.fieldMap`);
  }

  const fieldMapRecord = fieldMap as Record<string, unknown>;
  if (!hasNonEmptyString(fieldMapRecord, "title") || !hasNonEmptyString(fieldMapRecord, "url")) {
    throw new Error(`Source ${sourceId} (${type}) requires config.fieldMap.title and config.fieldMap.url`);
  }
}

function validateSourceTypeConfig(sourceId: string, type: SourceType, enabled: boolean, config: Record<string, unknown>): void {
  const schemaPlaceholder = isSchemaPlaceholder(config);
  if (schemaPlaceholder) {
    if (enabled) {
      throw new Error(`Source ${sourceId} (${type}) cannot enable config.placeholderMode=schema`);
    }

    return;
  }

  switch (type) {
    case "opml_rss":
      if (!hasNonEmptyString(config, "path")) {
        throw new Error(`Source ${sourceId} (${type}) requires config.path`);
      }
      return;
    case "custom_api":
      validateCustomApiFieldMap(sourceId, type, config);
      return;
    case "digest_feed":
      if (!hasNonEmptyString(config, "format") && !hasNonEmptyString(config, "linkSelector")) {
        throw new Error(`Source ${sourceId} (${type}) requires config.format or config.linkSelector`);
      }
      return;
    case "github_trending":
      return;
    case "x_home":
    case "x_list":
    case "x_bookmarks":
    case "x_likes":
    case "x_multi":
      if (!hasNonEmptyString(config, "birdMode")) {
        throw new Error(`Source ${sourceId} (${type}) requires config.birdMode`);
      }
      return;
    default:
      return;
  }
}

export function validateSource(input: unknown): Source {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid source entry");
  }

  const record = input as Record<string, unknown>;
  const id = assertString(record.id, "id");
  const type = assertSourceType(record.type);
  const enabled = assertBoolean(record.enabled, "source.enabled");
  const config = record.config === undefined ? {} : assertRecord(record.config, `source.${id}.config`);

  validateSourceTypeConfig(id, type, enabled, config);

  return {
    id,
    name: assertString(record.name, "name"),
    type,
    enabled,
    url: typeof record.url === "string" ? record.url : undefined,
    configJson: JSON.stringify(config),
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
    description: record.description === undefined ? undefined : assertString(record.description, "pack.description"),
    sourceIds: assertStringArray(record.sourceIds, "pack.sourceIds"),
    referenceOnly: record.referenceOnly === undefined ? false : assertBoolean(record.referenceOnly, "pack.referenceOnly"),
  };
}
