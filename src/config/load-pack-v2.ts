import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import type { InlineSource, SourcePackV2, SourceType } from "../types/index";
import { CANONICAL_SOURCE_TYPES } from "../types/index";

export const VALID_SOURCE_TYPES = new Set<SourceType>(CANONICAL_SOURCE_TYPES);

export function validateInlineSource(input: unknown): InlineSource {
  if (typeof input !== "object" || input === null) {
    throw new Error("InlineSource must be an object");
  }
  const record = input as Record<string, unknown>;

  if (!VALID_SOURCE_TYPES.has(record.type as SourceType)) {
    throw new Error(`Invalid source type: ${record.type}`);
  }
  if (typeof record.url !== "string" || !record.url) {
    throw new Error("InlineSource.url is required");
  }

  return {
    type: record.type as SourceType,
    url: record.url,
    description: typeof record.description === "string" ? record.description : undefined,
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
  };
}

export function validateSourcePackV2(input: unknown): SourcePackV2 {
  if (typeof input !== "object" || input === null) {
    throw new Error("SourcePackV2 must be an object");
  }
  const record = input as Record<string, unknown>;
  const pack = record.pack;

  if (typeof pack !== "object" || pack === null) {
    throw new Error("SourcePackV2.pack is required");
  }
  const packRecord = pack as Record<string, unknown>;

  if (typeof packRecord.id !== "string" || !packRecord.id) {
    throw new Error("SourcePackV2.pack.id is required");
  }
  if (typeof packRecord.name !== "string" || !packRecord.name) {
    throw new Error("SourcePackV2.pack.name is required");
  }

  const sources = Array.isArray(record.sources) ? record.sources : [];
  const validatedSources = sources.map((s: unknown) => validateInlineSource(s));

  return {
    id: packRecord.id,
    name: packRecord.name,
    description: typeof packRecord.description === "string" ? packRecord.description : undefined,
    keywords: Array.isArray(packRecord.keywords)
      ? packRecord.keywords.filter((k): k is string => typeof k === "string")
      : undefined,
    sources: validatedSources,
  };
}

async function loadYamlFile(filePath: string): Promise<Record<string, unknown>> {
  const absolutePath = resolve(process.cwd(), filePath);
  const fileContents = await readFile(absolutePath, "utf8");
  return (YAML.parse(fileContents) as Record<string, unknown> | null) ?? {};
}

export async function loadPackV2(filePath: string): Promise<SourcePackV2> {
  const parsed = await loadYamlFile(filePath);
  return validateSourcePackV2(parsed);
}
