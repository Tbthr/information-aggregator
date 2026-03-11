import { describe, expect, test } from "bun:test";
import { createDb } from "../db/client";
import { insertClusters } from "../db/queries/clusters";
import { insertNormalizedItems } from "../db/queries/normalized-items";
import { createOutput } from "../db/queries/outputs";
import { insertRawItems } from "../db/queries/raw-items";
import { createRun, finishRun } from "../db/queries/runs";
import { runQuery } from "../query/run-query";
import type { Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";
import { buildViewModel, renderViewMarkdown } from "../views/registry";

describe("profile-bound e2e", () => {
  test("runs daily-brief with resolved profile binding and persisted pipeline entities", async () => {
    const result = await runPostMvpFixture();

    expect(result.markdown).toContain("# Daily Digest");
    expect(result.markdown).toContain("Original Article");
    expect(result.persisted.rawItems).toBeGreaterThan(0);
    expect(result.persisted.normalizedItems).toBeGreaterThan(0);
    expect(result.persisted.clusters).toBeGreaterThan(0);
    expect(result.persisted.outputs).toBe(1);
  });

  test("dedupes a reddit discussion item against the linked original article", async () => {
    const result = await runPostMvpFixture();

    expect(result.persisted.rawItems).toBe(2);
    expect(result.persisted.normalizedItems).toBe(2);
    expect(result.persisted.clusters).toBe(1);
    expect(result.markdown).toContain("Original Article");
    expect(result.markdown).not.toContain("Reddit Discussion");
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
  let baseUrl = "";
  let redditListing = "";

  const server = Bun.serve({
    port: 0,
    fetch(request): Response {
      const url = new URL(request.url);
      if (url.pathname === "/reddit.json") {
        return new Response(redditListing, { headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/feed.xml") {
        return new Response(
          `<rss><channel><item><title>Original Article</title><link>${baseUrl}/post</link><pubDate>Mon, 09 Mar 2026 08:00:00 GMT</pubDate></item></channel></rss>`,
          { headers: { "content-type": "application/rss+xml" } },
        );
      }

      return new Response("not found", { status: 404 });
    },
  });

  baseUrl = `http://127.0.0.1:${server.port}`;
  redditListing = JSON.stringify({
    data: {
      children: [
        {
          data: {
            id: "abc",
            title: "Reddit Discussion",
            url: `${baseUrl}/reddit/comments/abc`,
            url_overridden_by_dest: `${baseUrl}/post`,
            permalink: "/r/artificial/comments/abc",
            author: "bob",
            subreddit: "artificial",
            created_utc: 1773046800,
            score: 42,
            num_comments: 9,
          },
        },
      ],
    },
  });
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
    {
      id: "rss-source",
      name: "RSS Source",
      type: "rss",
      enabled: true,
      url: `${baseUrl}/feed.xml`,
      configJson: "{}",
    },
  ];
  const profiles: TopicProfile[] = [
    {
      id: "default",
      name: "Default Digest",
      topicIds: ["ai-news"],
      sourcePackIds: ["community-pack"],
      defaultView: "daily-brief",
      defaultWindow: "24h",
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
      sourceIds: ["reddit-ai", "rss-source"],
    },
  ];

  try {
    const runId = "run-query-1";
    createRun(db, {
      id: runId,
      kind: "query",
      sourceSelectionJson: JSON.stringify([]),
      paramsJson: JSON.stringify({
        profileId: "default",
        viewId: "daily-brief",
        format: "markdown",
      }),
      status: "running",
      createdAt: "2026-03-09T12:00:00Z",
    });
    const result = await runQuery(
      {
        command: "run",
        profileId: "default",
        viewId: "daily-brief",
        format: "markdown",
      },
      {
        now: () => "2026-03-09T12:00:00Z",
        loadSources: async () => sources,
        loadProfiles: async () => profiles,
        loadTopics: async () => topics,
        loadSourcePacks: async () => sourcePacks,
      },
    );
    const markdown = renderViewMarkdown(buildViewModel(result, "daily-brief"), "daily-brief");
    insertRawItems(db, result.items);
    insertNormalizedItems(db, result.normalizedItems);
    insertClusters(db, result.clusters.map((cluster) => ({ ...cluster, runId })));
    createOutput(db, {
      id: `output-${runId}`,
      runId,
      kind: "query",
      format: "markdown",
      body: markdown,
      createdAt: "2026-03-09T12:00:00Z",
    });
    finishRun(db, runId, "succeeded", "2026-03-09T12:00:00Z");

    const rawItems = db.prepare("SELECT COUNT(*) AS count FROM raw_items").get() as { count: number };
    const normalizedItems = db.prepare("SELECT COUNT(*) AS count FROM normalized_items").get() as { count: number };
    const clusters = db.prepare("SELECT COUNT(*) AS count FROM clusters").get() as { count: number };
    const outputs = db.prepare("SELECT COUNT(*) AS count FROM outputs").get() as { count: number };

    return {
      markdown,
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
