import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { runDigest } from "../cli/run-digest";
import { runScan } from "../cli/run-scan";
import type { Source } from "../types/index";

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

describe("mock source end-to-end flow", () => {
  test("runScan fetches mock sources and renders combined markdown", async () => {
    const result = await runScan({
      profileId: "default",
      dryRun: true,
    }, {
      listSources: getMockSources,
    });

    expect(result.markdown).toContain("RSS Example");
    expect(result.markdown).toContain("JSON Feed Example");
  });

  test("runDigest fetches mock sources and renders digest markdown", async () => {
    const result = await runDigest({
      profileId: "default",
      dryRun: true,
    }, {
      listSources: getMockSources,
    });

    expect(result.markdown).toContain("RSS Example");
    expect(result.markdown).toContain("## Top Clusters");
  });
});
