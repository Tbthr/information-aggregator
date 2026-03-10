import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "./registry";

export function buildItemListView(result: QueryResult): ViewModel {
  return {
    viewId: "item-list",
    title: "Item List",
    sections: [
      {
        title: "Ranked Items",
        items: result.rankedItems.map((item) => ({
          title: item.title ?? item.normalizedTitle ?? item.id,
          url: item.url ?? item.canonicalUrl,
          score: item.finalScore,
          summary: item.topicMatchScore > 0 ? "Matches topic profile" : undefined,
        })),
      },
    ],
  };
}

export function renderItemListView(
  model: ViewModel,
  renderScan: (items: Array<{ title: string; url: string; finalScore: number; sourceName: string; rationale?: string }>) => string,
): string {
  const items = model.sections[0]?.items ?? [];
  return renderScan(
    items.map((item) => ({
      title: item.title,
      url: item.url ?? "",
      finalScore: item.score ?? 0,
      sourceName: "Query View",
      rationale: item.summary,
    })),
  );
}
