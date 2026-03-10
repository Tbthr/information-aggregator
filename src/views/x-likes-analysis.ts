import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "./registry";
import { buildXBookmarksAnalysisView } from "./x-bookmarks-analysis";

export function buildXLikesAnalysisView(result: QueryResult): ViewModel {
  const base = buildXBookmarksAnalysisView(result);
  return {
    ...base,
    viewId: "x-likes-analysis",
    title: "X Likes Analysis",
    summary: `Summary: ${result.rankedItems.length} liked items in range`,
  };
}
