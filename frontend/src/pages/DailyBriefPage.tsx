import { useState, useEffect } from "react";
import type { DailyBriefData } from "../types/api";

const API_BASE = "/api";

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

  // Loading 状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
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

  // 正常渲染
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* 1. Cover Story 封面故事 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
          封面故事
        </h2>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 min-h-24">
          {data?.coverStory ? (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {data.coverStory.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {data.coverStory.snippet || "暂无摘要"}
              </p>
            </div>
          ) : (
            <p className="text-gray-400">暂无封面故事</p>
          )}
        </div>
      </section>

      {/* 2. Lead Stories 重点报道 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
          重点报道
        </h2>
        <div className="space-y-3 min-h-24">
          {data?.leadStories?.length ? (
            data.leadStories.map((item) => (
              <div key={item.id} className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <h3 className="font-medium text-gray-900">{item.title}</h3>
                {item.snippet && (
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">{item.snippet}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-400">暂无重点报道</p>
          )}
        </div>
      </section>

      {/* 3. Top Signals 热门信号 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
          热门信号
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-24">
          {data?.topSignals?.length ? (
            data.topSignals.map((item) => (
              <div key={item.id} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <h3 className="font-medium text-gray-900 text-sm">{item.title}</h3>
              </div>
            ))
          ) : (
            <p className="text-gray-400 col-span-full">暂无热门信号</p>
          )}
        </div>
      </section>

      {/* 4. Scan Brief 快速扫描 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
          快速扫描
        </h2>
        <div className="bg-gray-50 rounded-lg p-4 min-h-24">
          {data?.scanBrief?.length ? (
            <ul className="space-y-2">
              {data.scanBrief.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 w-12">{item.score.toFixed(1)}</span>
                  <a href={item.url} className="text-gray-700 hover:text-blue-600 truncate">
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">暂无快速扫描内容</p>
          )}
        </div>
      </section>

      {/* 5. Saved for Later 稍后阅读 */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
          稍后阅读
        </h2>
        <div className="space-y-2 min-h-24">
          {data?.savedForLater?.length ? (
            data.savedForLater.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg p-3">
                <span className="text-green-600">★</span>
                <span className="text-gray-900 text-sm">{item.title}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400">暂无保存内容</p>
          )}
        </div>
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
