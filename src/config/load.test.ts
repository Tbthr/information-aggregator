import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig } from "./load";

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
    expect(ids.has("smaug-bookmarks")).toBe(false);
    expect(ids.has("x-ai-topic-selector-list")).toBe(false);
  });

  test("keeps packs and profile examples aligned with the curated defaults", async () => {
    const [sources, newsPackFile, blogsPackFile, topicsFile, profilesFile] = await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      readFile(resolve(process.cwd(), "config/packs/ai-news-sites.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "config/packs/ai-daily-digest-blogs.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "config/topics.example.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "config/profiles.example.yaml"), "utf8"),
    ]);

    const sourceIds = new Set(sources.map((source) => source.id));
    const newsPack = YAML.parse(newsPackFile) as { pack: { sourceIds: string[] } };
    const blogsPack = YAML.parse(blogsPackFile) as { pack: { sourceIds: string[] } };
    const topics = YAML.parse(topicsFile) as { topics: Array<{ id: string }> };
    const profiles = YAML.parse(profilesFile) as { profiles: Array<{ topicIds: string[]; sourcePackIds?: string[] }> };
    const topicIds = new Set(topics.topics.map((topic) => topic.id));

    for (const sourceId of [...newsPack.pack.sourceIds, ...blogsPack.pack.sourceIds]) {
      expect(sourceIds.has(sourceId)).toBe(true);
    }

    for (const topicId of profiles.profiles[0]?.topicIds ?? []) {
      expect(topicIds.has(topicId)).toBe(true);
    }

    expect(profiles.profiles[0]?.sourcePackIds).toEqual(["ai-news-sites", "ai-daily-digest-blogs"]);
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
