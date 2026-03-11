import type { InlineSource, SourcePack, SourceType } from "../types/index";
import type { ParsedRunArgs } from "../types/index";

export interface ResolvedSource {
  id: string;
  type: SourceType;
  url: string;
  description?: string;
  packId: string;
}

export interface ResolvedSelection {
  packIds: string[];
  viewId: string;
  window: string;
  sources: ResolvedSource[];
  keywords: string[];
}

function generateSourceId(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/[^a-z0-9]/gi, "-").slice(0, 30);
    return `${parsed.hostname.replace(/\./g, "-")}${path}`;
  } catch {
    return url.replace(/[^a-z0-9]/gi, "-").slice(0, 50);
  }
}

export function resolveSelection(
  args: ParsedRunArgs,
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
  const keywords = new Set<string>();
  const seenUrls = new Set<string>();

  for (const pack of selectedPacks) {
    for (const keyword of pack.keywords ?? []) {
      keywords.add(keyword);
    }

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
      });
    }
  }

  if (sources.length === 0) {
    throw new Error(`No enabled sources found in selected packs: ${args.packIds.join(", ")}`);
  }

  return {
    packIds: args.packIds,
    viewId: args.viewId,
    window: args.window,
    sources: sources.sort((a, b) => a.id.localeCompare(b.id)),
    keywords: [...keywords],
  };
}
