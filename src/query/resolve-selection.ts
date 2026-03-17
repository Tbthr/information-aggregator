import type { InlineSource, SourcePack, SourceType } from "../types/index";
import type { QueryArgs } from "./run-query";
import { generateSourceId } from "../config/source-id";

export interface ResolvedSource {
  id: string;
  type: SourceType;
  url: string;
  description?: string;
  packId: string;
  configJson?: string;
}

export interface ResolvedSelection {
  packIds: string[];
  viewId?: string;
  window: string;
  sources: ResolvedSource[];
}

export function resolveSelection(
  args: QueryArgs,
  packs: SourcePack[]
): ResolvedSelection {
  const selectedPackIds = new Set(args.packIds);
  const selectedPacks = packs.filter((pack) => selectedPackIds.has(pack.id));

  if (selectedPacks.length === 0) {
    throw new Error(`No packs found for IDs: ${args.packIds.join(", ")}`);
  }

  const missingPackIds = args.packIds.filter(
    (id) => !packs.some((pack) => pack.id === id)
  );
  if (missingPackIds.length > 0) {
    throw new Error(`Pack not found: ${missingPackIds.join(", ")}`);
  }

  const sources: ResolvedSource[] = [];
  const seenUrls = new Set<string>();

  for (const pack of selectedPacks) {
    for (const source of pack.sources) {
      if (source.enabled === false) {
        continue;
      }

      if (seenUrls.has(source.url)) {
        continue;
      }
      seenUrls.add(source.url);

      sources.push({
        id: generateSourceId(source.url),
        type: source.type,
        url: source.url,
        description: source.description,
        packId: pack.id,
        configJson: source.configJson,
      });
    }
  }

  if (sources.length === 0) {
    throw new Error(`No enabled sources found in selected packs: ${args.packIds.join(", ")}`);
  }

  return {
    packIds: args.packIds,
    viewId: args.viewId ?? "json",
    window: args.window,
    sources: sources.sort((a, b) => a.id.localeCompare(b.id)),
  };
}
