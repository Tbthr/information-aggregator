import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
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
    const typesById = new Map(sources.map((source) => [source.id, source.type]));

    expect(ids.size).toBeGreaterThan(100);
    expect(ids.has("example-rss")).toBe(false);
    expect(ids.has("openai-news")).toBe(true);
    expect(ids.has("techurls")).toBe(true);
    expect(ids.has("overreacted")).toBe(true);
    expect(ids.has("simon-willison")).toBe(true);
    expect(ids.has("clawfeed-digest-json")).toBe(true);
    expect(ids.has("smaug-bookmarks")).toBe(true);
    expect(ids.has("x-ai-topic-selector-list")).toBe(true);
    expect(ids.has("jeffgeerling-com")).toBe(true);
    expect(ids.has("clawfeed-hacker-news-front-page")).toBe(true);
    expect(ids.has("clawfeed-reddit-machine-learning")).toBe(true);
    expect(ids.has("clawfeed-github-trending")).toBe(true);
    expect(ids.has("smaug-likes")).toBe(true);
    expect(ids.has("smaug-both")).toBe(true);
    expect(ids.has("x-ai-topic-selector-home")).toBe(true);
    expect(ids.has("ai-news-radar-opml-import")).toBe(true);
    expect(typesById.get("clawfeed-github-trending")).toBe("github_trending");
    expect(typesById.get("smaug-bookmarks")).toBe("x_bookmarks");
    expect(typesById.get("smaug-likes")).toBe("x_likes");
    expect(typesById.get("smaug-both")).toBe("x_multi");
    expect(typesById.get("x-ai-topic-selector-home")).toBe("x_home");
    expect(typesById.get("ai-news-radar-opml-import")).toBe("opml_rss");
  });

  test("keeps packs and profile examples aligned with the curated defaults", async () => {
    const [sources, packFiles, topicsFile, profilesFile] = await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      readdir(resolve(process.cwd(), "config/packs")),
      readFile(resolve(process.cwd(), "config/topics.example.yaml"), "utf8"),
      readFile(resolve(process.cwd(), "config/profiles.example.yaml"), "utf8"),
    ]);

    const sourceIds = new Set(sources.map((source) => source.id));
    const packPayloads = await Promise.all(
      packFiles
        .filter((fileName) => fileName.endsWith(".yaml"))
        .sort()
        .map(async (fileName) => {
          const packFile = await readFile(resolve(process.cwd(), "config/packs", fileName), "utf8");
          return YAML.parse(packFile) as { pack: { id: string; sourceIds: string[] } };
        }),
    );
    const topics = YAML.parse(topicsFile) as { topics: Array<{ id: string }> };
    const profiles = YAML.parse(profilesFile) as { profiles: Array<{ topicIds: string[]; sourcePackIds?: string[] }> };
    const topicIds = new Set(topics.topics.map((topic) => topic.id));

    for (const pack of packPayloads) {
      for (const sourceId of pack.pack.sourceIds) {
        expect(sourceIds.has(sourceId)).toBe(true);
      }
    }

    for (const topicId of profiles.profiles[0]?.topicIds ?? []) {
      expect(topicIds.has(topicId)).toBe(true);
    }

    expect(profiles.profiles[0]?.sourcePackIds).toEqual(["ai-news-sites", "ai-daily-digest-blogs"]);
  });

  test("documents unsupported reference-project source types as disabled placeholders", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    const disabledUnsupported = new Map(
      sources
        .filter((source) => !source.enabled)
        .map((source) => [source.id, source.type]),
    );

    expect(disabledUnsupported.get("clawfeed-twitter-feed")).toBe("twitter_feed");
    expect(disabledUnsupported.get("clawfeed-twitter-bookmarks")).toBe("twitter_bookmarks");
    expect(disabledUnsupported.get("clawfeed-twitter-list")).toBe("twitter_list");
    expect(disabledUnsupported.get("clawfeed-github-trending")).toBe("github_trending");
    expect(disabledUnsupported.get("clawfeed-digest-feed")).toBe("digest_feed");
    expect(disabledUnsupported.get("clawfeed-custom-api")).toBe("custom_api");
    expect(disabledUnsupported.get("smaug-bookmarks")).toBe("x_bookmarks");
    expect(disabledUnsupported.get("smaug-likes")).toBe("x_likes");
    expect(disabledUnsupported.get("smaug-both")).toBe("x_multi");
    expect(disabledUnsupported.get("x-ai-topic-selector-home")).toBe("x_home");
    expect(disabledUnsupported.get("x-ai-topic-selector-list")).toBe("x_list");
    expect(disabledUnsupported.get("x-ai-topic-selector-bookmarks")).toBe("x_bookmarks");
    expect(disabledUnsupported.get("ai-news-radar-opml-import")).toBe("opml_rss");
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
