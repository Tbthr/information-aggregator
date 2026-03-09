import type { Source, SourcePack, TopicProfile } from "../types/index";

export interface ResolveProfileSelectionInput {
  profileId: string;
  profiles: TopicProfile[];
  sourcePacks: SourcePack[];
  sources: Source[];
}

export interface ResolvedProfileSelection {
  profile: TopicProfile;
  topicIds: string[];
  sourceIds: string[];
}

function requireProfile(profileId: string, profiles: TopicProfile[]): TopicProfile {
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }
  return profile;
}

function requireSourcePack(packId: string, sourcePacks: SourcePack[]): SourcePack {
  const sourcePack = sourcePacks.find((item) => item.id === packId);
  if (!sourcePack) {
    throw new Error(`Source pack not found: ${packId}`);
  }
  return sourcePack;
}

export function resolveProfileSelection(input: ResolveProfileSelectionInput): ResolvedProfileSelection {
  const profile = requireProfile(input.profileId, input.profiles);
  const enabledSourceIds = new Set(input.sources.filter((source) => source.enabled).map((source) => source.id));
  const sourceIds = new Set<string>();

  for (const packId of profile.sourcePackIds ?? []) {
    const sourcePack = requireSourcePack(packId, input.sourcePacks);
    for (const sourceId of sourcePack.sourceIds) {
      if (enabledSourceIds.has(sourceId)) {
        sourceIds.add(sourceId);
      }
    }
  }

  if (sourceIds.size === 0) {
    throw new Error(`Resolved profile has no enabled sources: ${profile.id}`);
  }

  return {
    profile,
    topicIds: [...profile.topicIds],
    sourceIds: [...sourceIds],
  };
}
