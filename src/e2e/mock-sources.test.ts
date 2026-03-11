import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { collectSources, type CollectDependencies } from "../pipeline/collect";
import { resolveSelection } from "../query/resolve-selection";
import { runQuery } from "../query/run-query";
import { renderQueryJson } from "../render/json";
import type { RawItem, QueryViewDefinition, Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";
import { buildViewModel, renderViewMarkdown } from "../views/registry";

const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item><title>RSS Example</title><link>http://127.0.0.1/item-rss</link><description>RSS body</description></item>
</channel></rss>`;

const jsonFeed = JSON.stringify({
  version: "https://jsonfeed.org/version/1.1",
  title: "Example JSON Feed",
  items: [
    {
      id: "json-1",
      title: "JSON Feed Example",
      url: "http://127.0.0.1/item-json",
      content_text: "JSON body",
    },
  ],
});

const websiteHtml = `<!doctype html>
<html>
  <head>
    <title>Website Example</title>
    <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
  </head>
  <body>Website body</body>
</html>`;

// X family fixture data (mock bird CLI output)
const xBirdFixture: RawItem[] = [
  {
    id: "x-tweet-1",
    sourceId: "x-bookmarks-1",
    title: "AI agents are reshaping workflows",
    url: "https://x.com/testuser/status/123",
    author: "testuser",
    snippet: "AI agents are reshaping workflows automation productivity",
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    metadataJson: JSON.stringify({
      provider: "bird",
      sourceType: "x_bookmarks",
      contentType: "social_post",
      engagement: { score: 100, comments: 10, reactions: 50 },
    }),
  },
  {
    id: "x-tweet-2",
    sourceId: "x-bookmarks-1",
    title: "Claude Code is amazing for development",
    url: "https://x.com/anotheruser/status/456",
    author: "anotheruser",
    snippet: "Claude Code is amazing for development coding ai tools",
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    metadataJson: JSON.stringify({
      provider: "bird",
      sourceType: "x_bookmarks",
      contentType: "social_post",
      engagement: { score: 200, comments: 20, reactions: 80 },
    }),
  },
];

let server: ReturnType<typeof Bun.serve> | null = null;
let baseUrl = "";

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/feed.xml") {
        return new Response(rssXml, { headers: { "content-type": "application/rss+xml" } });
      }
      if (url.pathname === "/feed.json") {
        return new Response(jsonFeed, { headers: { "content-type": "application/feed+json" } });
      }
      if (url.pathname === "/site") {
        return new Response(websiteHtml, { headers: { "content-type": "text/html" } });
      }
      return new Response("not found", { status: 404 });
    },
  });

  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(() => {
  server?.stop(true);
});

function getMockSources(): Source[] {
  return [
    {
      id: "rss-1",
      name: "RSS",
      type: "rss",
      enabled: true,
      url: `${baseUrl}/feed.xml`,
      configJson: "{}",
    },
    {
      id: "json-1",
      name: "JSON Feed",
      type: "json-feed",
      enabled: true,
      url: `${baseUrl}/feed.json`,
      configJson: "{}",
    },
    {
      id: "site-1",
      name: "Website",
      type: "website",
      enabled: true,
      url: `${baseUrl}/site`,
      configJson: "{}",
    },
  ];
}

function getMockProfiles(): TopicProfile[] {
  return [
    {
      id: "default",
      name: "Default",
      topicIds: ["ai-news"],
      sourcePackIds: ["mock-pack"],
      defaultView: "daily-brief",
      defaultWindow: "24h",
    },
  ];
}

function getMockTopics(): TopicDefinition[] {
  return [
    {
      id: "ai-news",
      name: "AI News",
      keywords: ["rss", "json", "website"],
    },
  ];
}

function getMockSourcePacks(): SourcePack[] {
  return [
    {
      id: "mock-pack",
      name: "Mock Pack",
      sourceIds: ["rss-1", "json-1", "site-1"],
    },
  ];
}

function getMockViews(): QueryViewDefinition[] {
  return [
    { id: "item-list", name: "Item List", defaultWindow: "7d", defaultSort: "recent" },
    { id: "daily-brief", name: "Daily Brief", defaultWindow: "24h", defaultSort: "ranked" },
  ];
}

// X family mock configuration
function getXMockSources(): Source[] {
  return [
    {
      id: "x-bookmarks-1",
      name: "X Bookmarks Mock",
      type: "x_bookmarks",
      enabled: true,
      url: "https://x.com/bookmarks",
      configJson: JSON.stringify({ birdMode: "bookmarks" }),
    },
    {
      id: "x-likes-1",
      name: "X Likes Mock",
      type: "x_likes",
      enabled: true,
      url: "https://x.com/likes",
      configJson: JSON.stringify({ birdMode: "likes" }),
    },
    {
      id: "x-home-1",
      name: "X Home Mock",
      type: "x_home",
      enabled: true,
      url: "https://x.com/home",
      configJson: JSON.stringify({ birdMode: "home" }),
    },
  ];
}

function getXMockProfiles(): TopicProfile[] {
  return [
    {
      id: "x-default",
      name: "X Default",
      topicIds: ["x-topics"],
      sourcePackIds: ["x-pack"],
      defaultView: "x-bookmarks-analysis",
      defaultWindow: "7d",
    },
  ];
}

function getXMockTopics(): TopicDefinition[] {
  return [
    {
      id: "x-topics",
      name: "X Topics",
      keywords: ["ai", "agents", "coding"],
    },
  ];
}

function getXMockSourcePacks(): SourcePack[] {
  return [
    {
      id: "x-pack",
      name: "X Pack",
      sourceIds: ["x-bookmarks-1", "x-likes-1", "x-home-1"],
    },
  ];
}

function getXMockViews(): QueryViewDefinition[] {
  return [
    {
      id: "x-bookmarks-analysis",
      name: "X Bookmarks Analysis",
      defaultWindow: "7d",
      defaultSort: "recent",
      defaultSourceTypes: ["x_bookmarks"],
    },
    {
      id: "x-likes-analysis",
      name: "X Likes Analysis",
      defaultWindow: "7d",
      defaultSort: "recent",
      defaultSourceTypes: ["x_likes"],
    },
    {
      id: "x-longform-hot",
      name: "X Longform Hot",
      defaultWindow: "7d",
      defaultSort: "ranked",
      defaultSourceTypes: ["x_home", "x_list", "x_multi"],
    },
  ];
}

// Mock collect dependencies for X family sources
function getXMockCollectDeps(): CollectDependencies {
  return {
    adapters: {
      x_bookmarks: async () => xBirdFixture,
      x_likes: async () => xBirdFixture,
      x_home: async () => xBirdFixture,
      x_list: async () => xBirdFixture,
      x_multi: async () => xBirdFixture,
    },
  };
}

describe("mock source end-to-end flow", () => {
  test("run --view item-list outputs markdown", async () => {
    const result = await runQuery({
      command: "run",
      profileId: "default",
      viewId: "item-list",
      format: "markdown",
    }, {
      loadSources: getMockSources,
      loadProfiles: getMockProfiles,
      loadTopics: getMockTopics,
      loadSourcePacks: getMockSourcePacks,
      loadViews: getMockViews,
    });
    const markdown = renderViewMarkdown(buildViewModel(result, "item-list"), "item-list");

    expect(markdown).toContain("RSS Example");
    expect(markdown).toContain("JSON Feed Example");
  });

  test("run --view daily-brief outputs markdown", async () => {
    const result = await runQuery({
      command: "run",
      profileId: "default",
      viewId: "daily-brief",
      format: "markdown",
    }, {
      loadSources: getMockSources,
      loadProfiles: getMockProfiles,
      loadTopics: getMockTopics,
      loadSourcePacks: getMockSourcePacks,
      loadViews: getMockViews,
    });
    const markdown = renderViewMarkdown(buildViewModel(result, "daily-brief"), "daily-brief");

    expect(markdown).toContain("RSS Example");
    expect(markdown).toContain("## Top Clusters");
  });

  test("run --format json outputs structured results", async () => {
    const result = await runQuery({
      command: "run",
      profileId: "default",
      viewId: "item-list",
      format: "json",
    }, {
      loadSources: getMockSources,
      loadProfiles: getMockProfiles,
      loadTopics: getMockTopics,
      loadSourcePacks: getMockSourcePacks,
      loadViews: getMockViews,
    });
    const json = renderQueryJson({
      queryResult: result,
      viewModel: buildViewModel(result, "item-list"),
    });

    expect(json).toContain("\"query\"");
    expect(json).toContain("\"selection\"");
    expect(json).toContain("\"rankedItems\"");
  });

  test("sources list returns tab-separated source rows", () => {
    const selection = resolveSelection({
      query: {
        command: "sources list",
        profileId: "default",
        sourceTypes: ["rss", "json-feed"],
        format: "markdown",
      },
      profiles: getMockProfiles(),
      sourcePacks: getMockSourcePacks(),
      sources: getMockSources(),
      views: getMockViews(),
    });
    const rows = selection.sources.map((source) => `${source.id}\t${source.type}\t${source.name}`);

    expect(rows).toEqual([
      "json-1\tjson-feed\tJSON Feed",
      "rss-1\trss\tRSS",
    ]);
  });
});

describe("x family mock source end-to-end flow", () => {
  test("run --view x-bookmarks-analysis outputs markdown", async () => {
    const result = await runQuery({
      command: "run",
      profileId: "x-default",
      viewId: "x-bookmarks-analysis",
      format: "markdown",
    }, {
      loadSources: getXMockSources,
      loadProfiles: getXMockProfiles,
      loadTopics: getXMockTopics,
      loadSourcePacks: getXMockSourcePacks,
      loadViews: getXMockViews,
      collectSources: (sources, deps) => {
        const xDeps = getXMockCollectDeps();
        return collectSources(sources, { ...deps, adapters: { ...deps.adapters, ...xDeps.adapters } });
      },
    });
    const markdown = renderViewMarkdown(buildViewModel(result, "x-bookmarks-analysis"), "x-bookmarks-analysis");

    expect(markdown).toContain("X Bookmarks Analysis");
    expect(markdown).toContain("Summary");
    expect(markdown).toContain("Top Themes");
    expect(markdown).toContain("Notable Items");
  });

  test("run --view x-likes-analysis outputs markdown", async () => {
    const result = await runQuery({
      command: "run",
      profileId: "x-default",
      viewId: "x-likes-analysis",
      format: "markdown",
    }, {
      loadSources: getXMockSources,
      loadProfiles: getXMockProfiles,
      loadTopics: getXMockTopics,
      loadSourcePacks: getXMockSourcePacks,
      loadViews: getXMockViews,
      collectSources: (sources, deps) => {
        const xDeps = getXMockCollectDeps();
        return collectSources(sources, { ...deps, adapters: { ...deps.adapters, ...xDeps.adapters } });
      },
    });
    const markdown = renderViewMarkdown(buildViewModel(result, "x-likes-analysis"), "x-likes-analysis");

    expect(markdown).toContain("X Likes Analysis");
    expect(markdown).toContain("Summary");
    expect(markdown).toContain("Top Themes");
  });

  test("run --view x-longform-hot outputs markdown", async () => {
    const result = await runQuery({
      command: "run",
      profileId: "x-default",
      viewId: "x-longform-hot",
      format: "markdown",
    }, {
      loadSources: getXMockSources,
      loadProfiles: getXMockProfiles,
      loadTopics: getXMockTopics,
      loadSourcePacks: getXMockSourcePacks,
      loadViews: getXMockViews,
      collectSources: (sources, deps) => {
        const xDeps = getXMockCollectDeps();
        return collectSources(sources, { ...deps, adapters: { ...deps.adapters, ...xDeps.adapters } });
      },
    });
    const markdown = renderViewMarkdown(buildViewModel(result, "x-longform-hot"), "x-longform-hot");

    expect(markdown).toContain("X Longform Hot");
    expect(markdown).toContain("Hot Posts");
    expect(markdown).toContain("Linked Articles");
    expect(markdown).toContain("Clusters");
  });
});
