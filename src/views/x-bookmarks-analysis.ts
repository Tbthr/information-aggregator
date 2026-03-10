import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "./registry";

function topTerms(result: QueryResult): string[] {
  const counts = new Map<string, number>();
  for (const item of result.rankedItems) {
    for (const word of (item.normalizedText ?? "").split(/\s+/).filter((token) => token.length > 4)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3).map(([term]) => term);
}

export function buildXBookmarksAnalysisView(result: QueryResult): ViewModel {
  return {
    viewId: "x-bookmarks-analysis",
    title: "X Bookmarks Analysis",
    summary: `Summary: ${result.rankedItems.length} bookmarked items in range`,
    sections: [
      {
        title: "Top Themes",
        items: topTerms(result).map((term) => ({ title: term })),
      },
      {
        title: "Notable Items",
        items: result.rankedItems.slice(0, 5).map((item) => ({
          title: item.title ?? item.normalizedTitle ?? item.id,
          url: item.url ?? item.canonicalUrl,
        })),
      },
    ],
  };
}

export function renderXAnalysisView(model: ViewModel): string {
  const lines = [`# ${model.title}`];
  if (model.summary) {
    lines.push("", model.summary);
  }

  for (const section of model.sections) {
    lines.push("", `## ${section.title}`);
    for (const item of section.items) {
      lines.push(item.url ? `- [${item.title}](${item.url})` : `- ${item.title}`);
      if (item.summary) {
        lines.push(`  - ${item.summary}`);
      }
    }
  }

  return lines.join("\n");
}
