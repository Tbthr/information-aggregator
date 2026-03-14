import { useState, useCallback, useMemo } from "react";

export type WindowOption = "1h" | "6h" | "24h" | "7d" | "30d" | "all";
export type SortOption = "score" | "recent" | "engagement";

interface FilterState {
  packs: string[];
  window: WindowOption;
  sort: SortOption;
  search: string;
  sources: string[];
  page: number;
}

const DEFAULT_STATE: FilterState = {
  packs: [],
  window: "24h",
  sort: "score",
  search: "",
  sources: [],
  page: 1,
};

/**
 * 过滤器状态管理 hook
 */
export function useFilters() {
  const [state, setState] = useState<FilterState>(DEFAULT_STATE);

  const setPacks = useCallback((packs: string[]) => {
    setState((prev) => ({ ...prev, packs, page: 1 }));
  }, []);

  const togglePack = useCallback((packId: string) => {
    setState((prev) => ({
      ...prev,
      packs: prev.packs.includes(packId)
        ? prev.packs.filter((id) => id !== packId)
        : [...prev.packs, packId],
      page: 1,
    }));
  }, []);

  const setWindow = useCallback((window: WindowOption) => {
    setState((prev) => ({ ...prev, window, page: 1 }));
  }, []);

  const setSort = useCallback((sort: SortOption) => {
    setState((prev) => ({ ...prev, sort, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setState((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const setSources = useCallback((sources: string[]) => {
    setState((prev) => ({ ...prev, sources, page: 1 }));
  }, []);

  const toggleSource = useCallback((sourceId: string) => {
    setState((prev) => ({
      ...prev,
      sources: prev.sources.includes(sourceId)
        ? prev.sources.filter((id) => id !== sourceId)
        : [...prev.sources, sourceId],
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const params = useMemo(
    () => ({
      packs: state.packs.length > 0 ? state.packs : undefined,
      window: state.window,
      sort: state.sort,
      search: state.search || undefined,
      sources: state.sources.length > 0 ? state.sources : undefined,
      page: state.page,
    }),
    [state]
  );

  return {
    state,
    params,
    setPacks,
    togglePack,
    setWindow,
    setSort,
    setSearch,
    setSources,
    toggleSource,
    setPage,
    reset,
  };
}
