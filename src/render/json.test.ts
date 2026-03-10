import { describe, expect, test } from "bun:test";

import type { QueryResult } from "../query/run-query";
import { renderQueryJson } from "./json";

describe("renderQueryJson", () => {
  test("serializes query results and view models", () => {
    const json = renderQueryJson({
      queryResult: {
        query: { command: "run", viewId: "item-list", format: "json" },
        selection: {
          view: { id: "item-list", name: "Item List" },
          topicIds: [],
          sourceIds: ["rss-1"],
          sources: [],
        },
        items: [],
        normalizedItems: [],
        rankedItems: [],
        clusters: [],
        warnings: [],
      } satisfies QueryResult,
      viewModel: {
        viewId: "item-list",
        title: "Item List",
        sections: [],
      },
    });

    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.query).toBeDefined();
    expect(parsed.selection).toBeDefined();
    expect(parsed.rankedItems).toBeDefined();
    expect(parsed.clusters).toBeDefined();
    expect(parsed.viewModel).toBeDefined();
  });
});
