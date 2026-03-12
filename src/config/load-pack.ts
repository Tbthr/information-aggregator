import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import YAML from "yaml";
import type { InlineSource, SourcePack, SourceType } from "../types/index";
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
    configJson: typeof record.configJson === "string" ? record.configJson : undefined,
  };
}

export function validateSourcePack(input: unknown): SourcePack {
  if (typeof input !== "object" || input === null) {
    throw new Error("SourcePack must be an object");
  }
  const record = input as Record<string, unknown>;
  const pack = record.pack;

  if (typeof pack !== "object" || pack === null) {
    throw new Error("SourcePack.pack is required");
  }
  const packRecord = pack as Record<string, unknown>;

  if (typeof packRecord.id !== "string" || !packRecord.id) {
    throw new Error("SourcePack.pack.id is required");
  }
  if (typeof packRecord.name !== "string" || !packRecord.name) {
    throw new Error("SourcePack.pack.name is required");
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
    auth: typeof packRecord.auth === "string" ? packRecord.auth : undefined,
    sources: validatedSources,
  };
}

async function loadYamlFile(filePath: string): Promise<Record<string, unknown>> {
  const absolutePath = resolve(process.cwd(), filePath);
  const fileContents = await readFile(absolutePath, "utf8");
  return (YAML.parse(fileContents) as Record<string, unknown> | null) ?? {};
}

export async function loadPack(filePath: string): Promise<SourcePack> {
  const parsed = await loadYamlFile(filePath);
  return validateSourcePack(parsed);
}

export async function loadAllPacks(directory: string): Promise<SourcePack[]> {
  const files = await readdir(directory);
  const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  const packs = await Promise.all(
    yamlFiles.map((f) => loadPack(join(directory, f)))
  );

  return packs;
}

export function dedupePacksBySourceUrl(packs: SourcePack[]): SourcePack[] {
  const seen = new Set<string>();

  return packs.map((pack) => ({
    ...pack,
    sources: pack.sources.filter((source) => {
      if (seen.has(source.url)) {
        return false;
      }
      seen.add(source.url);
      return true;
    }),
  }));
}
