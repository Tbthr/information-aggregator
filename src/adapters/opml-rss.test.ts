import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { collectOpmlRssSource } from "./opml-rss";

describe("collectOpmlRssSource", () => {
  test("reads OPML, fetches nested feeds, and flattens feed items", async () => {
    const directory = await mkdtemp(join(tmpdir(), "opml-rss-"));
    const opmlPath = join(directory, "feeds.opml");
    await writeFile(
      opmlPath,
      `<?xml version="1.0"?>
      <opml version="2.0">
        <body>
          <outline text="Feed One" xmlUrl="https://example.com/feed-one.xml" />
          <outline text="Feed Two" xmlUrl="https://example.com/feed-two.xml" />
        </body>
      </opml>`,
    );

    const fetchImpl = (async (url: string | URL | Request) =>
      new Response(
        `<rss><channel><item><title>${String(url).includes("one") ? "One" : "Two"}</title><link>${String(url).replace(".xml", "")}</link></item></channel></rss>`,
      )) as typeof fetch;

    const items = await collectOpmlRssSource(
      {
        id: "opml-source",
        name: "OPML Source",
        type: "opml_rss",
        enabled: false,
        configJson: JSON.stringify({ path: opmlPath }),
      },
      fetchImpl,
    );

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title)).toEqual(["One", "Two"]);
    expect(JSON.parse(items[0]?.metadataJson ?? "{}")).toEqual({
      provider: "rss",
      sourceType: "opml_rss",
      contentType: "article",
    });
  });
});
