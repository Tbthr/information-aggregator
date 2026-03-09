import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { loadSourcesConfig } from "./load";

describe("loadSourcesConfig", () => {
  test("loads example source definitions", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    expect(Array.isArray(sources)).toBe(true);
  });

  test("loads curated defaults instead of placeholder sources", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    const ids = new Set(sources.map((source) => source.id));

    expect(ids.size).toBeGreaterThan(5);
    expect(ids.has("example-rss")).toBe(false);
    expect(ids.has("openai-news")).toBe(true);
    expect(ids.has("overreacted")).toBe(true);
    expect(ids.has("simon-willison")).toBe(true);
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
    const profiles = YAML.parse(profilesFile) as { profiles: Array<{ topicIds: string[] }> };
    const topicIds = new Set(topics.topics.map((topic) => topic.id));

    for (const sourceId of [...newsPack.pack.sourceIds, ...blogsPack.pack.sourceIds]) {
      expect(sourceIds.has(sourceId)).toBe(true);
    }

    for (const topicId of profiles.profiles[0]?.topicIds ?? []) {
      expect(topicIds.has(topicId)).toBe(true);
    }
  });
});
