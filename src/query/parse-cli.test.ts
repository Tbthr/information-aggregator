import { describe, expect, test } from "bun:test";

import { parseQueryCliArgs } from "./parse-cli";

describe("parseQueryCliArgs", () => {
  test("parses run with a required view", () => {
    expect(parseQueryCliArgs(["run", "--view", "daily-brief"])).toMatchObject({
      command: "run",
      viewId: "daily-brief",
      format: "markdown",
    });
  });

  test("parses packs and relative windows", () => {
    expect(parseQueryCliArgs(["run", "--view", "item-list", "--pack", "ai-news-sites"])).toMatchObject({
      packIds: ["ai-news-sites"],
    });
    expect(parseQueryCliArgs(["run", "--view", "x-bookmarks-analysis", "--window", "7d"])).toMatchObject({
      window: "7d",
    });
  });

  test("parses absolute time ranges", () => {
    expect(
      parseQueryCliArgs([
        "run",
        "--view",
        "x-likes-analysis",
        "--since",
        "2026-03-01T00:00:00Z",
        "--until",
        "2026-03-08T00:00:00Z",
      ]),
    ).toMatchObject({
      since: "2026-03-01T00:00:00Z",
      until: "2026-03-08T00:00:00Z",
    });
  });

  test("parses source list filters", () => {
    expect(parseQueryCliArgs(["sources", "list", "--source-type", "x_bookmarks"])).toMatchObject({
      command: "sources list",
      sourceTypes: ["x_bookmarks"],
    });
  });
});
