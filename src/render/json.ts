import type { QueryResult } from "../query/run-query";
import type { ViewModel } from "../views/registry";

export function renderQueryJson(input: { queryResult: QueryResult; viewModel: ViewModel }): string {
  return JSON.stringify({
    args: input.queryResult.args,
    selection: input.queryResult.selection,
    items: input.queryResult.items,
    normalizedItems: input.queryResult.normalizedItems,
    rankedItems: input.queryResult.rankedItems,
    clusters: input.queryResult.clusters,
    warnings: input.queryResult.warnings,
    viewModel: input.viewModel,
  }, null, 2);
}
