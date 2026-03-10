import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

import type { QueryViewDefinition, Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";
import { validateProfile, validateSource, validateSourcePack, validateTopic, validateView } from "./validate";

async function loadYamlFile(filePath: string): Promise<Record<string, unknown>> {
  const absolutePath = resolve(process.cwd(), filePath);
  const fileContents = await readFile(absolutePath, "utf8");
  return (YAML.parse(fileContents) as Record<string, unknown> | null) ?? {};
}

export async function loadSourcesConfig(filePath: string, options: { includeDisabled?: boolean } = {}): Promise<Source[]> {
  const parsed = (await loadYamlFile(filePath)) as { sources?: unknown[] };

  if (!Array.isArray(parsed.sources)) {
    throw new Error("Invalid sources config: sources must be an array");
  }

  const sources = parsed.sources.map((source) => validateSource(source));
  return options.includeDisabled ? sources : sources.filter((source) => source.enabled);
}

export async function loadTopicsConfig(filePath: string): Promise<TopicDefinition[]> {
  const parsed = (await loadYamlFile(filePath)) as { topics?: unknown[] };

  if (!Array.isArray(parsed.topics)) {
    throw new Error("Invalid topics config: topics must be an array");
  }

  return parsed.topics.map((topic) => validateTopic(topic));
}

export async function loadProfilesConfig(filePath: string): Promise<TopicProfile[]> {
  const parsed = (await loadYamlFile(filePath)) as { profiles?: unknown[] };

  if (!Array.isArray(parsed.profiles)) {
    throw new Error("Invalid profiles config: profiles must be an array");
  }

  return parsed.profiles.map((profile) => validateProfile(profile));
}

export async function loadSourcePacksConfig(filePath: string): Promise<SourcePack[]> {
  const parsed = (await loadYamlFile(filePath)) as { pack?: unknown; packs?: unknown[] };

  if (Array.isArray(parsed.packs)) {
    return parsed.packs.map((pack) => validateSourcePack(pack));
  }

  if (parsed.pack) {
    return [validateSourcePack(parsed.pack)];
  }

  throw new Error("Invalid source packs config: expected pack or packs");
}

export async function loadViewsConfig(filePath: string): Promise<QueryViewDefinition[]> {
  const parsed = (await loadYamlFile(filePath)) as { views?: unknown[] };

  if (!Array.isArray(parsed.views)) {
    throw new Error("Invalid views config: views must be an array");
  }

  return parsed.views.map((view) => validateView(view));
}
