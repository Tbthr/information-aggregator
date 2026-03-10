import { describe, expect, test } from "bun:test";

import { loadViewsConfig } from "./load";

describe("views config", () => {
  test("loads example views and preserves defaults", async () => {
    const views = await loadViewsConfig("config/views.example.yaml");
    const ids = views.map((view) => view.id);

    expect(ids).toEqual([
      "daily-brief",
      "item-list",
      "x-longform-hot",
      "x-bookmarks-analysis",
      "x-likes-analysis",
    ]);
    expect(views.find((view) => view.id === "daily-brief")).toMatchObject({
      defaultWindow: "24h",
      defaultSort: "ranked",
    });
    expect(views.find((view) => view.id === "x-bookmarks-analysis")?.defaultSourceTypes).toEqual(["x_bookmarks"]);
  });
});
