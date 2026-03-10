import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "../views/registry";

export function renderQueryJson(input: { queryResult: QueryResult; viewModel: ViewModel }): string {
  return JSON.stringify({
    query: input.queryResult.query,
    selection: input.queryResult.selection,
    rankedItems: input.queryResult.rankedItems,
    clusters: input.queryResult.clusters,
    warnings: input.queryResult.warnings,
    viewModel: input.viewModel,
  }, null, 2);
}
