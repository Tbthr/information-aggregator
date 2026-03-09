import { describe, expect, test } from "bun:test";
import { runDigest } from "../cli/run-digest";
import { createDb } from "../db/client";
import type { Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";

describe("post mvp e2e", () => {
  test("runs digest with resolved profile binding and persisted pipeline entities", async () => {
    const result = await runPostMvpFixture();

    expect(result.markdown).toContain("# Daily Digest");
    expect(result.markdown).toContain("Reddit Example");
    expect(result.persisted.rawItems).toBeGreaterThan(0);
    expect(result.persisted.normalizedItems).toBeGreaterThan(0);
    expect(result.persisted.clusters).toBeGreaterThan(0);
    expect(result.persisted.outputs).toBe(1);
  });
});

async function runPostMvpFixture(): Promise<{
  markdown: string;
  persisted: {
    rawItems: number;
    normalizedItems: number;
    clusters: number;
    outputs: number;
  };
}> {
  const redditListing = JSON.stringify({
    data: {
      children: [
        {
          data: {
            id: "abc",
            title: "Reddit Example",
            url: "http://127.0.0.1/post",
            author: "bob",
            subreddit: "artificial",
          },
        },
      ],
    },
  });
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/reddit.json") {
        return new Response(redditListing, { headers: { "content-type": "application/json" } });
      }

      return new Response("not found", { status: 404 });
    },
  });

  const baseUrl = `http://127.0.0.1:${server.port}`;
  const db = createDb(":memory:");
  const sources: Source[] = [
    {
      id: "reddit-ai",
      name: "Reddit AI",
      type: "reddit",
      enabled: true,
      url: `${baseUrl}/reddit.json`,
      configJson: "{}",
    },
  ];
  const profiles: TopicProfile[] = [
    {
      id: "default",
      name: "Default Digest",
      mode: "digest",
      topicIds: ["ai-news"],
      sourcePackIds: ["community-pack"],
    },
  ];
  const topics: TopicDefinition[] = [
    {
      id: "ai-news",
      name: "AI News",
      keywords: ["reddit", "example"],
    },
  ];
  const sourcePacks: SourcePack[] = [
    {
      id: "community-pack",
      name: "Community Pack",
      sourceIds: ["reddit-ai"],
    },
  ];

  try {
    const result = await runDigest(
      {
        profileId: "default",
        dryRun: false,
      },
      {
        db,
        loadSources: async () => sources,
        loadProfiles: async () => profiles,
        loadTopics: async () => topics,
        loadSourcePacks: async () => sourcePacks,
      },
    );

    const rawItems = db.prepare("SELECT COUNT(*) AS count FROM raw_items").get() as { count: number };
    const normalizedItems = db.prepare("SELECT COUNT(*) AS count FROM normalized_items").get() as { count: number };
    const clusters = db.prepare("SELECT COUNT(*) AS count FROM clusters").get() as { count: number };
    const outputs = db.prepare("SELECT COUNT(*) AS count FROM outputs").get() as { count: number };

    return {
      markdown: result.markdown,
      persisted: {
        rawItems: rawItems.count,
        normalizedItems: normalizedItems.count,
        clusters: clusters.count,
        outputs: outputs.count,
      },
    };
  } finally {
    server.stop(true);
  }
}
