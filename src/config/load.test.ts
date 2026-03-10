import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig } from "./load";
import { CANONICAL_SOURCE_TYPES } from "../types/index";

describe("config loading", () => {
  test("loads example source definitions", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");

    expect(Array.isArray(sources)).toBe(true);
  });

  test("loads curated defaults instead of placeholder sources", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    const ids = new Set(sources.map((source) => source.id));

    expect(ids.size).toBeGreaterThan(15);
    expect(ids.has("example-rss")).toBe(false);
    expect(ids.has("openai-news")).toBe(true);
    expect(ids.has("techurls")).toBe(true);
    expect(ids.has("overreacted")).toBe(true);
    expect(ids.has("simon-willison")).toBe(true);
    expect(ids.has("clawfeed-digest-json")).toBe(true);
    expect(ids.has("smaug-bookmarks")).toBe(true);
    expect(ids.has("x-ai-topic-selector-list")).toBe(true);
  });

  test("keeps packs and profile examples aligned with the curated defaults", async () => {
    const [sources, packFiles, topicsFile, profilesFile] = await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      Promise.all([
        "config/packs/ai-news-sites.yaml",
        "config/packs/ai-daily-digest-blogs.yaml",
        "config/packs/ai-daily-digest-reference-full.yaml",
        "config/packs/ai-news-radar-reference.yaml",
        "config/packs/clawfeed-reference.yaml",
        "config/packs/smaug-reference.yaml",
        "config/packs/x-ai-topic-selector-reference.yaml",
      ].map((filePath) => readFile(resolve(process.cwd(), filePath), "utf8"))),
      readFile(resolve(process.cwd(), "config/topics.example.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "config/profiles.example.yaml"), "utf8"),
    ]);

    const sourceIds = new Set(sources.map((source) => source.id));
    const packs = packFiles.map((file) => YAML.parse(file) as { pack: { id: string; sourceIds: string[]; referenceOnly?: boolean } });
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
    expect(packs.find((pack) => pack.pack.id === "ai-daily-digest-reference-full")?.pack.referenceOnly).toBe(true);
    expect(packs.find((pack) => pack.pack.id === "clawfeed-reference")?.pack.referenceOnly).toBe(true);
    expect(profiles.profiles[0]?.sourcePackIds).toEqual(["ai-news-sites", "ai-daily-digest-blogs"]);
  });

  test("uses canonical source taxonomy and removes deprecated aliases", async () => {
    const [sourcesFile, readmeFile, designFile] = await Promise.all([
      readFile(resolve(process.cwd(), "config/sources.example.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "README.md"), "utf8"),
      readFile(resolve(process.cwd(), "docs/plans/2026-03-10-source-type-roadmap-design.md"), "utf8"),
    ]);

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
    expect(profiles[0]?.sourcePackIds).toEqual(["ai-news-sites", "ai-daily-digest-blogs"]);
  });

  test("loads source packs from local yaml files", async () => {
    const packs = await loadSourcePacksConfig("config/packs/ai-news-sites.yaml");

    expect(packs).toHaveLength(1);
    expect(packs[0]?.id).toBe("ai-news-sites");
    expect(packs[0]?.sourceIds).toContain("openai-news");
  });
});
