import { describe, expect, test } from "bun:test";

import type { Source, SourcePack, TopicProfile } from "../types/index";
import { resolveProfileSelection } from "./resolve-profile";

const profiles: TopicProfile[] = [
  {
    id: "default",
    name: "Default Digest",
    mode: "digest",
    topicIds: ["ai-news"],
    sourcePackIds: ["pack-a", "pack-b"],
  },
];

const sourcePacks: SourcePack[] = [
  { id: "pack-a", name: "Pack A", sourceIds: ["rss-1", "rss-2"] },
  { id: "pack-b", name: "Pack B", sourceIds: ["rss-2", "rss-3"] },
];

const sources: Source[] = [
  { id: "rss-1", name: "One", type: "rss", enabled: true, configJson: "{}" },
  { id: "rss-2", name: "Two", type: "rss", enabled: false, configJson: "{}" },
  { id: "rss-3", name: "Three", type: "rss", enabled: true, configJson: "{}" },
];

describe("resolveProfileSelection", () => {
  test("expands source packs into enabled unique source ids", () => {
    const result = resolveProfileSelection({
      profileId: "default",
      profiles,
      sourcePacks,
      sources,
    });

    expect(result.profile.id).toBe("default");
    expect(result.topicIds).toEqual(["ai-news"]);
    expect(result.sourceIds).toEqual(["rss-1", "rss-3"]);
  });

  test("throws when profile id is missing", () => {
    expect(() =>
      resolveProfileSelection({
        profileId: "missing",
        profiles,
        sourcePacks,
        sources,
      }),
    ).toThrow("Profile not found: missing");
  });

  test("throws when a referenced source pack is missing", () => {
    expect(() =>
      resolveProfileSelection({
        profileId: "default",
        profiles: [
          {
            ...profiles[0],
            sourcePackIds: ["missing-pack"],
          },
        ],
        sourcePacks,
        sources,
      }),
    ).toThrow("Source pack not found: missing-pack");
  });

  test("throws when no enabled sources remain after resolution", () => {
    expect(() =>
      resolveProfileSelection({
        profileId: "default",
        profiles,
        sourcePacks,
        sources: sources.map((source) => ({ ...source, enabled: false })),
      }),
    ).toThrow("Resolved profile has no enabled sources: default");
  });
});
