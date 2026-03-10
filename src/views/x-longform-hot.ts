import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "./registry";

export function buildXLongformHotView(result: QueryResult): ViewModel {
  const hotPosts = result.rankedItems.slice(0, 5).map((item) => ({
    title: item.title ?? item.normalizedTitle ?? item.id,
    url: item.linkedCanonicalUrl ?? item.url ?? item.canonicalUrl,
    score: item.finalScore,
    summary: item.linkedCanonicalUrl ? "linked article" : undefined,
  }));
  const linkedArticles = result.rankedItems
    .filter((item) => item.linkedCanonicalUrl)
    .map((item) => ({
      title: item.title ?? item.normalizedTitle ?? item.id,
      url: item.linkedCanonicalUrl,
      summary: item.relationshipToCanonical === "discussion" ? "discussion source" : "linked article",
    }));
  const clusters = result.clusters.map((cluster) => ({
    title: cluster.title ?? cluster.canonicalItemId,
    url: cluster.url,
    summary: cluster.summary,
  }));

  return {
    viewId: "x-longform-hot",
    title: "X Longform Hot",
    sections: [
      { title: "Hot Posts", items: hotPosts },
      { title: "Linked Articles", items: linkedArticles },
      { title: "Clusters", items: clusters },
    ],
  };
}

export function renderXLongformHotView(model: ViewModel): string {
  const lines = [`# ${model.title}`];
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
