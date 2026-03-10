import type { QueryViewDefinition, Source, SourcePack, SourceType, TopicProfile } from "../types/index";
import type { QuerySpec } from "./spec";

export interface ResolvedSelection {
  profile?: TopicProfile;
  view: QueryViewDefinition;
  topicIds: string[];
  sourceIds: string[];
  sources: Source[];
  window?: string;
  since?: string;
  until?: string;
}

function requireView(viewId: string | undefined, views: QueryViewDefinition[], profile?: TopicProfile): QueryViewDefinition {
  const resolvedId = viewId ?? profile?.defaultView ?? "daily-brief";
  const view = views.find((item) => item.id === resolvedId);
  if (!view) {
    throw new Error(`View not found: ${resolvedId}`);
  }
  return view;
}

function requireProfile(profileId: string | undefined, profiles: TopicProfile[]): TopicProfile | undefined {
  const resolvedId = profileId ?? "default";
  return profiles.find((item) => item.id === resolvedId);
}

function expandPackIds(packIds: string[] | undefined, sourcePacks: SourcePack[]): string[] {
  const selected = new Set<string>();

  for (const packId of packIds ?? []) {
    const pack = sourcePacks.find((item) => item.id === packId);
    if (!pack) {
      throw new Error(`Source pack not found: ${packId}`);
    }
    for (const sourceId of pack.sourceIds) {
      selected.add(sourceId);
    }
  }

  return [...selected];
}

function ensureValidRange(since: string | undefined, until: string | undefined): void {
  if (!since || !until) {
    return;
  }

  if (Date.parse(since) > Date.parse(until)) {
    throw new Error("Invalid time range: since must be before until");
  }
}

function applySourceTypeFilter(sources: Source[], sourceTypes: SourceType[] | undefined): Source[] {
  if (!sourceTypes || sourceTypes.length === 0) {
    return sources;
  }

  const allowed = new Set(sourceTypes);
  return sources.filter((source) => allowed.has(source.type));
}

export function resolveSelection(input: {
  query: QuerySpec;
  profiles: TopicProfile[];
  sourcePacks: SourcePack[];
  sources: Source[];
  views: QueryViewDefinition[];
}): ResolvedSelection {
  const profile = requireProfile(input.query.profileId, input.profiles);
  const view = requireView(input.query.viewId, input.views, profile);
  const packIds = [...(profile?.sourcePackIds ?? []), ...(input.query.packIds ?? [])];
  const expandedPackSources = expandPackIds(packIds, input.sourcePacks);
  const requestedSourceIds = new Set([...(expandedPackSources ?? []), ...(input.query.sourceIds ?? [])]);
  const window = input.query.window ?? view.defaultWindow ?? profile?.defaultWindow;
  const effectiveSourceTypes = input.query.sourceTypes && input.query.sourceTypes.length > 0
    ? input.query.sourceTypes
    : view.defaultSourceTypes;
  const topicIds = [...new Set([...(profile?.topicIds ?? []), ...(input.query.topicIds ?? [])])];

  ensureValidRange(input.query.since, input.query.until);

  let selectedSources = input.sources.filter((source) => source.enabled);
  selectedSources = applySourceTypeFilter(selectedSources, effectiveSourceTypes);

  if (requestedSourceIds.size > 0) {
    selectedSources = selectedSources.filter((source) => requestedSourceIds.has(source.id));
  }

  if (selectedSources.length === 0 && effectiveSourceTypes && effectiveSourceTypes.length > 0) {
    throw new Error(`View ${view.id} requires at least one enabled source matching ${effectiveSourceTypes.join(", ")}`);
  }

  return {
    profile,
    view,
    topicIds,
    sourceIds: selectedSources.map((source) => source.id).sort(),
    sources: selectedSources.sort((left, right) => left.id.localeCompare(right.id)),
    window,
    since: input.query.since,
    until: input.query.until,
  };
}
