import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import YAML from "yaml";
import type { InlineSource, SourcePack, SourceType, PackPolicy, SourcePolicy, PolicyMode } from "../types/index";
import { CANONICAL_SOURCE_TYPES } from "../types/index";
import { isRecord, isArray, isString, isBoolean } from "../types/validation";

const VALID_POLICY_MODES: PolicyMode[] = ['assist_only', 'filter_then_assist'];
const DEFAULT_POLICY_MODE: PolicyMode = 'filter_then_assist';

export const VALID_SOURCE_TYPES = new Set<SourceType>(CANONICAL_SOURCE_TYPES);

function validatePackPolicy(input: unknown): PackPolicy | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const modeValue = input.mode;
  if (!isString(modeValue) || !VALID_POLICY_MODES.includes(modeValue as PolicyMode)) {
    return undefined;
  }
  return {
    mode: modeValue as PolicyMode,
    filterPrompt: isString(input.filterPrompt) ? input.filterPrompt : undefined,
  };
}

export function validateInlineSource(input: unknown, packPolicy?: PackPolicy): InlineSource {
  if (!isRecord(input)) {
    throw new Error("InlineSource must be an object");
  }

  const typeValue = input.type;
  if (!isString(typeValue) || !VALID_SOURCE_TYPES.has(typeValue as SourceType)) {
    throw new Error(`Invalid source type: ${typeValue}`);
  }
  if (!isString(input.url) || input.url === "") {
    throw new Error("InlineSource.url is required");
  }

  // 解析 source 的 policy，若无则继承 pack 的 policy
  let sourcePolicy: SourcePolicy | undefined;
  const parsedPolicy = validatePackPolicy(input.policy);
  if (parsedPolicy) {
    sourcePolicy = parsedPolicy;
  } else if (packPolicy) {
    sourcePolicy = { ...packPolicy, inheritedFrom: 'pack' };
  }

  return {
    type: typeValue as SourceType,
    url: input.url,
    description: isString(input.description) ? input.description : undefined,
    enabled: isBoolean(input.enabled) ? input.enabled : true,
    configJson: isString(input.configJson) ? input.configJson : undefined,
    policy: sourcePolicy,
  };
}

export function validateSourcePack(input: unknown): SourcePack {
  if (!isRecord(input)) {
    throw new Error("SourcePack must be an object");
  }

  const pack = input.pack;
  if (!isRecord(pack)) {
    throw new Error("SourcePack.pack is required");
  }

  if (!isString(pack.id) || pack.id === "") {
    throw new Error("SourcePack.pack.id is required");
  }
  if (!isString(pack.name) || pack.name === "") {
    throw new Error("SourcePack.pack.name is required");
  }

  // 解析 pack 的 policy，若无则默认 filter_then_assist
  let packPolicy: PackPolicy = validatePackPolicy(pack.policy) ?? {
    mode: DEFAULT_POLICY_MODE,
  };

  const sources = isArray(input.sources) ? input.sources : [];
  const validatedSources = sources.map((s: unknown) => validateInlineSource(s, packPolicy));

  const keywords = isArray(pack.keywords)
    ? pack.keywords.filter(isString)
    : undefined;

  return {
    id: pack.id,
    name: pack.name,
    description: isString(pack.description) ? pack.description : undefined,
    keywords,
    auth: isString(pack.auth) ? pack.auth : undefined,
    sources: validatedSources,
    policy: packPolicy,
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
