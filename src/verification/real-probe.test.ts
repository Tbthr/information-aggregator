import { describe, expect, test } from "bun:test";

import { getRealProbeSources, probeLooksHealthy } from "./real-probe";

describe("real probe helpers", () => {
  test("returns the documented public source set", () => {
    const sources = getRealProbeSources();
    expect(sources.map((source) => source.type)).toEqual([
      "rss",
      "json-feed",
      "website",
      "hn",
      "reddit",
      "github_trending",
    ]);
  });

  test("accepts markdown with links as a healthy probe result", () => {
    expect(probeLooksHealthy("# Scan Results\n\n- [Item](https://example.com)")).toBe(true);
  });
});
