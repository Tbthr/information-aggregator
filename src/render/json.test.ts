import { describe, expect, test } from "bun:test";

import type { QueryResult } from "../query/run-query";
import { renderQueryJson } from "./json";

describe("renderQueryJson", () => {
  test("serializes query results and view models", () => {
    const json = renderQueryJson({
      queryResult: {
        args: {
          packIds: ["ai-news"],
          viewId: "item-list",
          window: "7d",
        },
        selection: {
          packIds: ["ai-news"],
          viewId: "item-list",
          window: "7d",
          sources: [],
          keywords: [],
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
    expect(parsed.args).toBeDefined();
    expect(parsed.selection).toBeDefined();
    expect(parsed.items).toBeDefined();
    expect(parsed.normalizedItems).toBeDefined();
    expect(parsed.rankedItems).toBeDefined();
    expect(parsed.clusters).toBeDefined();
    expect(parsed.viewModel).toBeDefined();
  });
});
