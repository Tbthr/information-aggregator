import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

import { CANONICAL_SOURCE_TYPES } from "../types/index";
import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig } from "./load";

describe("config loading", () => {
  test("loads example source definitions", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");

    expect(Array.isArray(sources)).toBe(true);
  });

  test("loads curated defaults and reference-source coverage", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    const ids = new Set(sources.map((source) => source.id));
    const typesById = new Map(sources.map((source) => [source.id, source.type]));

    expect(ids.size).toBeGreaterThan(100);
    expect(ids.has("example-rss")).toBe(false);
    expect(ids.has("openai-news")).toBe(true);
    expect(ids.has("techurls")).toBe(true);
    expect(ids.has("waytoagi-history")).toBe(true);
    expect(ids.has("jeffgeerling-com")).toBe(true);
    expect(ids.has("hn-front-page-reference")).toBe(true);
    expect(ids.has("x-home-reference")).toBe(true);
    expect(ids.has("x-multi-reference")).toBe(true);
    expect(ids.has("x-bookmarks-reference")).toBe(true);
    expect(ids.has("opml-rss-local-import-reference")).toBe(true);
    expect(typesById.get("github-trending-typescript-reference")).toBe("github_trending");
    expect(typesById.get("x-bookmarks-reference")).toBe("x_bookmarks");
    expect(typesById.get("x-likes-reference")).toBe("x_likes");
    expect(typesById.get("x-multi-reference")).toBe("x_multi");
    expect(typesById.get("x-home-reference")).toBe("x_home");
    expect(typesById.get("opml-rss-local-import-reference")).toBe("opml_rss");
  });

  test("keeps packs and profile examples aligned with the curated defaults", async () => {
    const [sources, packFileNames, topicsFile, profilesFile] = await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      readdir(resolve(process.cwd(), "config/packs")),
      readFile(resolve(process.cwd(), "config/topics.example.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "config/profiles.example.yaml"), "utf8"),
    ]);

    const sourceIds = new Set(sources.map((source) => source.id));
    const packs = await Promise.all(
      packFileNames
        .filter((fileName) => fileName.endsWith(".yaml"))
        .sort()
        .map(async (fileName) => {
          const file = await readFile(resolve(process.cwd(), "config/packs", fileName), "utf8");
          return YAML.parse(file) as { pack: { id: string; sourceIds: string[]; referenceOnly?: boolean; description?: string } };
        }),
    );
    const topics = YAML.parse(topicsFile) as { topics: Array<{ id: string }> };
    const profiles = YAML.parse(profilesFile) as { profiles: Array<{ topicIds: string[]; sourcePackIds?: string[] }> };
    const topicIds = new Set(topics.topics.map((topic) => topic.id));

    for (const sourceId of packs.flatMap((pack) => pack.pack.sourceIds)) {
      expect(sourceIds.has(sourceId)).toBe(true);
    }

    for (const topicId of profiles.profiles[0]?.topicIds ?? []) {
      expect(topicIds.has(topicId)).toBe(true);
    }

    expect(packs.find((pack) => pack.pack.id === "ai-news-sites")?.pack.referenceOnly).toBe(false);
    expect(packs.find((pack) => pack.pack.id === "engineering-blogs-reference-hnpc-2025")?.pack.referenceOnly).toBe(true);
    expect(packs.find((pack) => pack.pack.id === "x-auth-reference")?.pack.referenceOnly).toBe(true);
    expect(packs.find((pack) => pack.pack.id === "engineering-blogs-reference-hnpc-2025")?.pack.description).toBe(
      "90 RSS feeds from Hacker News Popularity Contest 2025 (curated by Karpathy)",
    );
    expect(profiles.profiles[0]?.sourcePackIds).toEqual(["ai-news-sites", "engineering-blogs-core"]);
  });

  test("keeps default runnable packs limited to enabled public sources", async () => {
    const [sources, newsPacks, blogPacks] = await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      loadSourcePacksConfig("config/packs/ai-news-sites.yaml"),
      loadSourcePacksConfig("config/packs/engineering-blogs-core.yaml"),
    ]);

    const defaultPackSourceIds = new Set([...newsPacks, ...blogPacks].flatMap((pack) => pack.sourceIds));
    const disabledDefaultSources = sources
      .filter((source) => defaultPackSourceIds.has(source.id))
      .filter((source) => source.enabled === false)
      .map((source) => source.id);

    expect(disabledDefaultSources).toEqual([]);
  });

  test("uses canonical source taxonomy and removes deprecated aliases", async () => {
    const [sourcesFile, readmeFile, designFile] = await Promise.all([
      readFile(resolve(process.cwd(), "config/sources.example.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "README.md"), "utf8"),
      readFile(resolve(process.cwd(), "docs/plans/2026-03-10-source-type-roadmap-design.md"), "utf8"),
    ]);

    expect(sourcesFile.includes("twitter_")).toBe(false);
    expect(sourcesFile.includes("hackernews")).toBe(false);
    expect(readmeFile.includes("twitter_")).toBe(false);
    expect(readmeFile.includes("hackernews")).toBe(false);
    expect(designFile.includes("twitter_")).toBe(false);
    expect(designFile.includes("hackernews")).toBe(false);

    const sources = await loadSourcesConfig("config/sources.example.yaml");
    const sourceTypes = new Set(sources.map((source) => source.type));

    for (const sourceType of sourceTypes) {
      expect(CANONICAL_SOURCE_TYPES.includes(sourceType)).toBe(true);
    }
  });

  test("loads topics from local yaml files", async () => {
    const topics = await loadTopicsConfig("config/topics.example.yaml");

    expect(topics).toHaveLength(2);
    expect(topics[0]?.id).toBe("ai-news");
  });

  test("loads profiles from local yaml files", async () => {
    const profiles = await loadProfilesConfig("config/profiles.example.yaml");

    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.topicIds).toEqual(["ai-news", "engineering-blogs"]);
    expect(profiles[0]?.sourcePackIds).toEqual(["ai-news-sites", "engineering-blogs-core"]);
  });

  test("loads source packs from local yaml files", async () => {
    const packs = await loadSourcePacksConfig("config/packs/ai-news-sites.yaml");

    expect(packs).toHaveLength(1);
    expect(packs[0]?.id).toBe("ai-news-sites");
    expect(packs[0]?.sourceIds).toContain("openai-news");
  });
});
