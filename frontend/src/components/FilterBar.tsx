import { WindowOption, SortOption } from "../hooks/useFilters";

interface FilterBarProps {
  window: WindowOption;
  sort: SortOption;
  search: string;
  onWindowChange: (window: WindowOption) => void;
  onSortChange: (sort: SortOption) => void;
  onSearchChange: (search: string) => void;
}

const WINDOW_OPTIONS: { value: WindowOption; label: string }[] = [
  { value: "1h", label: "1小时" },
  { value: "6h", label: "6小时" },
  { value: "24h", label: "24小时" },
  { value: "7d", label: "7天" },
  { value: "30d", label: "30天" },
  { value: "all", label: "全部" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "score", label: "按分数" },
  { value: "recent", label: "按时间" },
  { value: "engagement", label: "按热度" },
];

export function FilterBar({
  window,
  sort,
  search,
  onWindowChange,
  onSortChange,
  onSearchChange,
}: FilterBarProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Time Window */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">时间窗口:</label>
          <select
            value={window}
            onChange={(e) => onWindowChange(e.target.value as WindowOption)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">排序:</label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="搜索标题或摘要..."
              className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 pl-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
