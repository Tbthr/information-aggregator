import { readFile } from "node:fs/promises";

import type { RawItem, Source } from "../types/index";
import { parseRssItems } from "./rss";

function getSourceConfig(source: Source): Record<string, unknown> {
  return JSON.parse(source.configJson ?? "{}") as Record<string, unknown>;
}

function extractOpmlFeedUrls(opml: string): string[] {
  return [...opml.matchAll(/xmlUrl="([^"]+)"/g)].map((match) => match[1]);
}

export async function collectOpmlRssSource(
  source: Source,
  fetchImpl: typeof fetch = fetch,
  readFileImpl: typeof readFile = readFile,
): Promise<RawItem[]> {
  const config = getSourceConfig(source);
  const path = typeof config.path === "string" ? config.path : null;
  if (!path) {
    throw new Error("opml_rss source requires config.path");
  }

  const opml = await readFileImpl(path, "utf8");
  const feedUrls = extractOpmlFeedUrls(opml);
  const items = await Promise.all(
    feedUrls.map(async (feedUrl) => {
      const response = await fetchImpl(feedUrl);
      const xml = await response.text();
      return parseRssItems(xml, source.id).map((item) => ({
        ...item,
        metadataJson: JSON.stringify({
          provider: "rss",
          sourceType: "opml_rss",
          contentType: "article",
        }),
      }));
    }),
  );

  return items.flat();
}
