import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { runQuery } from "../query/run-query";
import { renderQueryJson } from "../render/json";
import { buildViewModel, renderViewMarkdown } from "../views/registry";
import type { QueryViewDefinition, Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";

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
});
