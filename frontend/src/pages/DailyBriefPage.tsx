import { useState, useEffect } from "react";
import type { DailyBriefData, ItemData, ScanBriefItem } from "../types/api";
import { CoverStorySection } from "../components/views/CoverStorySection";
import { LeadStoriesSection } from "../components/views/LeadStoriesSection";
import { TopSignalsSection } from "../components/views/TopSignalsSection";
import { ScanBriefSection } from "../components/views/ScanBriefSection";
import { SavedForLaterSection } from "../components/views/SavedForLaterSection";
import { API_BASE } from "../lib/api";

/**
 * Daily Brief 页面 - 展示每日精选内容
 */
export function DailyBriefPage() {
  const [data, setData] = useState<DailyBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDailyBrief = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/views/daily-brief`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        setData(result.data ?? result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchDailyBrief();
  }, []);

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-pulse">
      {/* Cover Story skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
      {/* Lead Stories skeleton */}
      <div>
        <div className="h-5 bg-gray-200 rounded w-24 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
      {/* Top Signals skeleton */}
      <div>
        <div className="h-5 bg-gray-200 rounded w-24 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );

  // Loading 状态
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Error 状态
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h3 className="font-semibold mb-2">加载失败</h3>
          <p className="text-sm">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-red-800 text-sm transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // Empty state - 检查是否有任何内容
  const hasContent = data && (
    data.coverStory ||
    (data.leadStories && data.leadStories.length > 0) ||
    (data.topSignals && data.topSignals.length > 0) ||
    (data.scanBrief && data.scanBrief.length > 0) ||
    (data.savedForLater && data.savedForLater.length > 0)
  );

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无内容</h3>
          <p className="text-gray-500 mb-4">
            今日还没有聚合任何内容，请稍后再来查看，或者检查数据源配置。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* 1. Cover Story 封面故事 */}
      <CoverStorySection item={(data?.coverStory ?? null) as ItemData | null} />

      {/* 2. Lead Stories 重点报道 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">重点报道</h2>
        <LeadStoriesSection items={(data?.leadStories ?? []) as ItemData[]} />
      </section>

      {/* 3. Top Signals 热门信号 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">热门信号</h2>
        <TopSignalsSection items={(data?.topSignals ?? []) as ItemData[]} />
      </section>

      {/* 4. Scan Brief 快速扫描 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">快速扫描</h2>
        <ScanBriefSection items={(data?.scanBrief ?? []) as ScanBriefItem[]} />
      </section>

      {/* 5. Saved for Later 稍后阅读 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-4">稍后阅读</h2>
        <SavedForLaterSection items={(data?.savedForLater ?? []) as ItemData[]} />
      </section>

      {/* Meta 信息 */}
      {data?.meta && (
        <footer className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          生成时间: {new Date(data.meta.generatedAt).toLocaleString("zh-CN")} |
          总条目: {data.meta.totalItems} |
          保留: {data.meta.keptItems} |
          保留率: {(data.meta.retentionRate * 100).toFixed(1)}%
        </footer>
      )}
    </div>
  );
}

export default DailyBriefPage;
