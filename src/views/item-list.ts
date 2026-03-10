import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "./registry";

function relationSummary(result: QueryResult["rankedItems"][number]): string | undefined {
  if (!result.linkedCanonicalUrl) {
    return undefined;
  }

  return result.relationshipToCanonical === "discussion" ? "discussion source" : "linked article";
}

export function buildItemListView(result: QueryResult): ViewModel {
  return {
    viewId: "item-list",
    title: "Item List",
    sections: [
      {
        title: "Ranked Items",
        items: result.rankedItems.map((item) => ({
          title: item.title ?? item.normalizedTitle ?? item.id,
          url: item.linkedCanonicalUrl ?? item.url ?? item.canonicalUrl,
          score: item.finalScore,
          summary: [
            relationSummary(item),
            item.topicMatchScore > 0 ? "Matches topic profile" : undefined,
          ].filter(Boolean).join("; ") || undefined,
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
