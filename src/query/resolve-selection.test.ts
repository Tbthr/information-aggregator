import { describe, expect, test } from "bun:test";

import type { QueryViewDefinition, Source, SourcePack, TopicProfile } from "../types/index";
import { resolveSelection } from "./resolve-selection";
import type { QuerySpec } from "./spec";

const profiles: TopicProfile[] = [
  {
    id: "default",
    name: "Default Query",
    topicIds: ["ai-news"],
    sourcePackIds: ["pack-a"],
    defaultView: "daily-brief",
    defaultWindow: "24h",
  },
];

const sourcePacks: SourcePack[] = [
  { id: "pack-a", name: "Pack A", sourceIds: ["rss-1", "bookmarks-1"] },
  { id: "pack-b", name: "Pack B", sourceIds: ["likes-1"] },
];

const sources: Source[] = [
  { id: "rss-1", name: "One", type: "rss", enabled: true, configJson: "{}" },
  { id: "bookmarks-1", name: "Bookmarks", type: "x_bookmarks", enabled: true, configJson: "{}" },
  { id: "likes-1", name: "Likes", type: "x_likes", enabled: true, configJson: "{}" },
];

const views: QueryViewDefinition[] = [
  { id: "daily-brief", name: "Daily Brief", defaultWindow: "24h", defaultSort: "ranked" },
  { id: "x-bookmarks-analysis", name: "Bookmarks", defaultWindow: "7d", defaultSourceTypes: ["x_bookmarks"] },
];

function makeQuery(overrides: Partial<QuerySpec> = {}): QuerySpec {
  return {
    command: "run",
    format: "markdown",
    ...overrides,
  };
}

describe("resolveSelection", () => {
  test("falls back to the default profile when no selectors are provided", () => {
    const result = resolveSelection({ query: makeQuery(), profiles, sourcePacks, sources, views });

    expect(result.profile?.id).toBe("default");
    expect(result.view.id).toBe("daily-brief");
    expect(result.sourceIds).toEqual(["bookmarks-1", "rss-1"]);
    expect(result.topicIds).toEqual(["ai-news"]);
  });

  test("layers pack, source-type, source, and topic selectors together", () => {
    const result = resolveSelection({
      query: makeQuery({
        viewId: "x-bookmarks-analysis",
        packIds: ["pack-a", "pack-b"],
        sourceTypes: ["x_bookmarks", "x_likes"],
        sourceIds: ["likes-1"],
        topicIds: ["agents"],
      }),
      profiles,
      sourcePacks,
      sources,
      views,
    });

    expect(result.sourceIds).toEqual(["bookmarks-1", "likes-1"]);
    expect(result.topicIds).toEqual(["ai-news", "agents"]);
    expect(result.window).toBe("7d");
  });

  test("applies view defaults before explicit overrides", () => {
    const result = resolveSelection({
      query: makeQuery({
        viewId: "x-bookmarks-analysis",
        window: "30d",
      }),
      profiles,
      sourcePacks,
      sources,
      views,
    });

    expect(result.window).toBe("30d");
  });

  test("throws when since is after until", () => {
    expect(() =>
      resolveSelection({
        query: makeQuery({
          viewId: "daily-brief",
          since: "2026-03-08T00:00:00Z",
          until: "2026-03-01T00:00:00Z",
        }),
        profiles,
        sourcePacks,
        sources,
        views,
      }),
    ).toThrow("Invalid time range: since must be before until");
  });

  test("throws a clear error when a view requires a missing source type", () => {
    expect(() =>
      resolveSelection({
        query: makeQuery({ viewId: "x-bookmarks-analysis" }),
        profiles,
        sourcePacks,
        sources: sources.filter((source) => source.type !== "x_bookmarks"),
        views,
      }),
    ).toThrow("View x-bookmarks-analysis requires at least one enabled source matching x_bookmarks");
  });
});
