import { PackInfo, SourceInfo } from "../types/api";

interface SidebarProps {
  packs: PackInfo[];
  selectedPacks: string[];
  sources: SourceInfo[];
  selectedSources?: string[];
  onTogglePack: (packId: string) => void;
  onToggleSource?: (sourceId: string) => void;
  loading?: boolean;
}

export function Sidebar({ packs, selectedPacks, sources, selectedSources = [], onTogglePack, onToggleSource, loading }: SidebarProps) {
  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Packs Section */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Packs
        </h3>
        <div className="space-y-2">
          {packs.map((pack) => (
            <label
              key={pack.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={selectedPacks.includes(pack.id)}
                onChange={() => onTogglePack(pack.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {pack.name}
                </div>
                {pack.description && (
                  <div className="text-xs text-gray-500 truncate">
                    {pack.description}
                  </div>
                )}
              </div>
              {pack.itemCount > 0 && (
                <span className="text-xs text-gray-400">{pack.itemCount}</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Sources Section */}
      {sources.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            数据源 ({sources.length})
          </h3>
          <div className="space-y-1">
            {sources.slice(0, 10).map((source) => (
              <label
                key={source.id}
                className={`flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-gray-50 cursor-pointer ${onToggleSource ? "" : "pointer-events-none"}`}
              >
                {onToggleSource && (
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(source.id)}
                    onChange={() => onToggleSource(source.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                )}
                <span
                  className={`w-2 h-2 rounded-full ${
                    source.health.consecutiveFailures > 0
                      ? "bg-red-400"
                      : "bg-green-400"
                  }`}
                />
                <span className="text-gray-700 truncate flex-1">{source.id}</span>
                <span className="text-xs text-gray-400">
                  {source.itemCount}
                </span>
              </label>
            ))}
            {sources.length > 10 && (
              <div className="text-xs text-gray-400 text-center py-2">
                还有 {sources.length - 10} 个数据源...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
