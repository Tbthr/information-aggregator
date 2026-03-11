import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "./registry";

function truncateTheme(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= 20) {
    return normalized;
  }
  return `${normalized.slice(0, 20).trimEnd()}...`;
}

function topThemes(result: QueryResult): string[] {
  const seen = new Set<string>();
  const themes: string[] = [];

  for (const item of result.rankedItems) {
    const candidate = item.title ?? item.normalizedTitle ?? item.id;
    const theme = truncateTheme(candidate);
    if (theme === "" || seen.has(theme)) {
      continue;
    }
    seen.add(theme);
    themes.push(theme);
    if (themes.length === 3) {
      break;
    }
  }

  return themes;
}

export function buildXBookmarksAnalysisView(result: QueryResult): ViewModel {
  return {
    viewId: "x-bookmarks-analysis",
    title: "X Bookmarks Analysis",
    summary: `Summary: ${result.rankedItems.length} bookmarked items in range`,
    sections: [
      {
        title: "Top Themes",
        items: topThemes(result).map((theme) => ({ title: theme })),
      },
      {
        title: "Notable Items",
        items: result.rankedItems.slice(0, 5).map((item) => ({
          title: item.title ?? item.normalizedTitle ?? item.id,
          url: item.linkedCanonicalUrl ?? item.url ?? item.canonicalUrl,
          summary: item.linkedCanonicalUrl
            ? item.relationshipToCanonical === "discussion"
              ? "discussion source"
              : "linked article"
            : undefined,
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
