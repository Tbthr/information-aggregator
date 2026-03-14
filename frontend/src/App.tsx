import { useItems, usePacks } from "./hooks/useApi";
import { useFilters } from "./hooks/useFilters";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar";
import { FilterBar } from "./components/FilterBar";
import { ItemList } from "./components/ItemList";
import { Pagination } from "./components/Pagination";

function App() {
  const { state, params, togglePack, toggleSource, setPage, setWindow, setSort, setSearch } = useFilters();

  const { data: packsData, loading: packsLoading } = usePacks(true);
  const { data: itemsData, loading: itemsLoading, error } = useItems({
    ...params,
    pageSize: 20,
  });

  const items = itemsData?.data?.items ?? [];
  const sources = itemsData?.data?.sources ?? [];
  const pagination = itemsData?.meta?.pagination;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
          <Sidebar
            packs={packsData?.packs ?? []}
            selectedPacks={state.packs}
            sources={sources}
            selectedSources={state.sources}
            onTogglePack={togglePack}
            onToggleSource={toggleSource}
            loading={packsLoading}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Filter Bar */}
          <FilterBar
            window={state.window}
            sort={state.sort}
            search={state.search}
            onWindowChange={setWindow}
            onSortChange={setSort}
            onSearchChange={setSearch}
          />

          {/* Items List */}
          <div className="p-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                加载失败: {error.message}
              </div>
            )}

            <ItemList items={items} loading={itemsLoading} />

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  current={state.page}
                  total={pagination.totalPages}
                  onChange={handlePageChange}
                />
              </div>
            )}

            {/* Stats Footer */}
            {pagination && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                共 {pagination.total} 条结果，第 {pagination.page} / {pagination.totalPages} 页
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}

export default App;
