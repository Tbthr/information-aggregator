import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectCustomApiSource } from "../adapters/custom-api";
import { collectDigestFeedSource } from "../adapters/digest-feed";
import { collectGitHubTrendingSource } from "../adapters/github-trending";
import { collectHnSource } from "../adapters/hn";
import { collectJsonFeedSource } from "../adapters/json-feed-collect";
import { collectOpmlRssSource } from "../adapters/opml-rss";
import { collectRedditSource } from "../adapters/reddit";
import { collectRssSource } from "../adapters/rss";
import { collectWebsiteSource } from "../adapters/website";
import { collectXBirdSource } from "../adapters/x-bird";
import { runDigest } from "../cli/run-digest";
import { runScan } from "../cli/run-scan";
import { collectSources } from "../pipeline/collect";
import type { Source, SourcePack, TopicDefinition, TopicProfile } from "../types/index";

let server: ReturnType<typeof Bun.serve> | null = null;
let baseUrl = "";
let tempDir = "";
let opmlPath = "";

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ia-source-runtime-"));
  opmlPath = join(tempDir, "feeds.opml");

  server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/feed.xml") {
        return new Response(
          `<?xml version="1.0"?><rss><channel><item><title>rss item</title><link>https://example.com/rss</link><pubDate>Tue, 10 Mar 2026 10:00:00 GMT</pubDate></item></channel></rss>`,
          { headers: { "content-type": "application/rss+xml" } },
        );
      }

      if (url.pathname === "/feed.json") {
        return Response.json({
          version: "https://jsonfeed.org/version/1.1",
          items: [
            {
              id: "json-1",
              title: "json item",
              url: "https://example.com/json",
              date_published: "2026-03-10T10:00:00.000Z",
            },
          ],
        });
      }

      if (url.pathname === "/site") {
        return new Response(
          `<!doctype html><html><head><title>website source</title><link rel="alternate" type="application/rss+xml" href="/site-feed.xml" /></head><body>site</body></html>`,
          { headers: { "content-type": "text/html" } },
        );
      }

      if (url.pathname === "/hn.json") {
        return Response.json({
          hits: [
            {
              objectID: "99",
              title: "hn item",
              url: "https://example.com/hn",
              author: "alice",
              created_at_i: 1773136800,
              points: 12,
            },
          ],
        });
      }

      if (url.pathname === "/reddit.json") {
        return Response.json({
          kind: "Listing",
          data: {
            children: [
              {
                kind: "t3",
                data: {
                  id: "abc",
                  title: "reddit item",
                  url: "https://www.reddit.com/r/test/comments/abc",
                  url_overridden_by_dest: "https://example.com/reddit",
                  permalink: "/r/test/comments/abc",
                  author: "bob",
                  subreddit: "test",
                  created_utc: 1773136800,
                  score: 18,
                  num_comments: 4,
                },
              },
            ],
          },
        });
      }

      if (url.pathname === "/trending") {
        return new Response(
          `<article><h2><a href="/owner/repo">owner / repo</a></h2><p>repo summary</p><span itemprop="programmingLanguage">TypeScript</span></article>`,
          { headers: { "content-type": "text/html" } },
        );
      }

      if (url.pathname === "/digest.json") {
        return Response.json({
          digests: [
            {
              id: 165,
              content: "digest body https://example.com/digest",
            },
          ],
        });
      }

      if (url.pathname === "/custom.json") {
        return Response.json({
          data: {
            items: [
              {
                headline: "custom item",
                link: "https://example.com/custom",
                summary: "summary",
                published: "2026-03-10T10:00:00.000Z",
              },
            ],
          },
        });
      }

      if (url.pathname === "/one.xml") {
        return new Response(
          `<?xml version="1.0"?><rss><channel><item><title>opml one item</title><link>https://example.com/opml-one</link><pubDate>Tue, 10 Mar 2026 10:00:00 GMT</pubDate></item></channel></rss>`,
          { headers: { "content-type": "application/rss+xml" } },
        );
      }

      if (url.pathname === "/two.xml") {
        return new Response(
          `<?xml version="1.0"?><rss><channel><item><title>opml two item</title><link>https://example.com/opml-two</link><pubDate>Tue, 10 Mar 2026 10:00:00 GMT</pubDate></item></channel></rss>`,
          { headers: { "content-type": "application/rss+xml" } },
        );
      }

      return new Response("not found", { status: 404 });
    },
  });

  baseUrl = `http://127.0.0.1:${server.port}`;
  await writeFile(
    opmlPath,
    `<?xml version="1.0"?><opml version="2.0"><body><outline text="One" xmlUrl="${baseUrl}/one.xml" /><outline text="Two" xmlUrl="${baseUrl}/two.xml" /></body></opml>`,
  );
});

afterAll(async () => {
  server?.stop(true);
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

function getSources(): Source[] {
  return [
    { id: "rss", name: "RSS", type: "rss", enabled: true, url: `${baseUrl}/feed.xml`, configJson: "{}" },
    { id: "json", name: "JSON Feed", type: "json-feed", enabled: true, url: `${baseUrl}/feed.json`, configJson: "{}" },
    { id: "website", name: "Website", type: "website", enabled: true, url: `${baseUrl}/site`, configJson: "{}" },
    { id: "hn", name: "HN", type: "hn", enabled: true, url: `${baseUrl}/hn.json`, configJson: "{}" },
    { id: "reddit", name: "Reddit", type: "reddit", enabled: true, url: `${baseUrl}/reddit.json`, configJson: "{}" },
    { id: "github", name: "GitHub Trending", type: "github_trending", enabled: true, url: `${baseUrl}/trending`, configJson: "{}" },
    {
      id: "digest",
      name: "Digest Feed",
      type: "digest_feed",
      enabled: true,
      url: `${baseUrl}/digest.json`,
      configJson: JSON.stringify({ format: "json", itemPath: "digests", contentField: "content" }),
    },
    {
      id: "custom",
      name: "Custom API",
      type: "custom_api",
      enabled: true,
      url: `${baseUrl}/custom.json`,
      configJson: JSON.stringify({ itemPath: "data.items", fieldMap: { title: "headline", url: "link", snippet: "summary", publishedAt: "published" } }),
    },
    {
      id: "opml",
      name: "OPML RSS",
      type: "opml_rss",
      enabled: true,
      configJson: JSON.stringify({ path: opmlPath }),
    },
    { id: "x-home", name: "X Home", type: "x_home", enabled: true, configJson: JSON.stringify({ birdMode: "home" }) },
    { id: "x-bookmarks", name: "X Bookmarks", type: "x_bookmarks", enabled: true, configJson: JSON.stringify({ birdMode: "bookmarks" }) },
    { id: "x-likes", name: "X Likes", type: "x_likes", enabled: true, configJson: JSON.stringify({ birdMode: "likes" }) },
    { id: "x-list", name: "X List", type: "x_list", enabled: true, configJson: JSON.stringify({ birdMode: "list", listId: "123" }) },
  ];
}

function getProfiles(mode: "scan" | "digest"): TopicProfile[] {
  return [
    {
      id: "all",
      name: "All Sources",
      mode,
      topicIds: ["all-topics"],
      sourcePackIds: ["all-pack"],
    },
  ];
}

function getTopics(): TopicDefinition[] {
  return [
    {
      id: "all-topics",
      name: "All Topics",
      keywords: ["item", "repo", "digest", "x"],
    },
  ];
}

function getSourcePacks(): SourcePack[] {
  return [
    {
      id: "all-pack",
      name: "All Pack",
      sourceIds: getSources().map((source) => source.id),
    },
  ];
}

async function collectRepairedSources(sources: Source[]) {
  return collectSources(sources, {
    adapters: {
      custom_api: (source) => collectCustomApiSource(source),
      digest_feed: (source) => collectDigestFeedSource(source),
      github_trending: (source) => collectGitHubTrendingSource(source),
      hn: (source) => collectHnSource(source),
      reddit: (source) => collectRedditSource(source),
      "json-feed": (source) => collectJsonFeedSource(source),
      opml_rss: (source) => collectOpmlRssSource(source),
      rss: (source) => collectRssSource(source),
      website: (source) => collectWebsiteSource(source),
      x_home: (source) =>
        collectXBirdSource(source, async () =>
          JSON.stringify([{ id: "home-1", text: "x home item", url: "https://x.com/example/status/home", created_at: "2026-03-10T10:00:00.000Z" }])
        ),
      x_bookmarks: (source) =>
        collectXBirdSource(source, async () =>
          JSON.stringify([{ id: "bookmarks-1", text: "x bookmarks item", url: "https://x.com/example/status/bookmarks", created_at: "2026-03-10T10:00:00.000Z" }])
        ),
      x_likes: (source) =>
        collectXBirdSource(source, async () =>
          JSON.stringify([{ id: "likes-1", text: "x likes item", url: "https://x.com/example/status/likes", created_at: "2026-03-10T10:00:00.000Z" }])
        ),
      x_list: (source) =>
        collectXBirdSource(source, async () =>
          JSON.stringify([{ id: "list-123-1", text: "x list item", url: "https://x.com/example/status/list", created_at: "2026-03-10T10:00:00.000Z" }])
        ),
      x_multi: (source) => collectXBirdSource(source, async () => JSON.stringify([])),
    },
  });
}

describe("source runtime repair e2e", () => {
  test("runs scan across repaired source types", async () => {
    const result = await runScan({
      profileId: "all",
      dryRun: true,
    }, {
      loadSources: getSources,
      loadProfiles: () => getProfiles("scan"),
      loadTopics: getTopics,
      loadSourcePacks: getSourcePacks,
      collectSources: collectRepairedSources,
      now: () => "2026-03-10T12:00:00.000Z",
    });

    expect(result.markdown).toContain("hn item");
    expect(result.markdown).toContain("reddit item");
    expect(result.markdown).toContain("owner / repo");
    expect(result.markdown).toContain("Digest 165");
    expect(result.markdown).toContain("x home item");
    expect(result.markdown).toContain("x list item");
  });

  test("runs digest across repaired source types", async () => {
    const result = await runDigest({
      profileId: "all",
      dryRun: true,
    }, {
      loadSources: getSources,
      loadProfiles: () => getProfiles("digest"),
      loadTopics: getTopics,
      loadSourcePacks: getSourcePacks,
      collectSources: collectRepairedSources,
      now: () => "2026-03-10T12:00:00.000Z",
    });

    expect(result.markdown).toContain("# Daily Digest");
    expect(result.markdown).toContain("owner / repo");
    expect(result.markdown).toContain("digest 165");
    expect(result.markdown).toContain("x bookmarks item");
  });
});
