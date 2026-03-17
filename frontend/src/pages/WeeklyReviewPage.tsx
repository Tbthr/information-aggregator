import { useEffect, useState } from "react";
import { WeeklyReviewData } from "../types/api";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * WeeklyReviewPage - 周报回顾页面
 * 显示本周内容汇总、主题聚合、编辑精选
 */
export function WeeklyReviewPage() {
  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowDays] = useState(7);

  useEffect(() => {
    async function fetchWeeklyReview() {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_BASE}/api/views/weekly-review?window=${windowDays}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch weekly review");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    fetchWeeklyReview();
  }, [windowDays]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">加载失败: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Weekly Review ({windowDays} Days)
          </h1>
          <p className="text-gray-600">
            {formatDate(data.overview.windowStart)} - {formatDate(data.overview.windowEnd)}
          </p>
        </header>

        {/* Overview */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">本周概览</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{data.overview.totalCount}</div>
              <div className="text-sm text-gray-500">总内容数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.overview.retainedCount}</div>
              <div className="text-sm text-gray-500">保留内容</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(data.overview.retentionRate * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">保留率</div>
            </div>
          </div>
        </section>

        {/* Topics */}
        {data.topics.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">主题聚合</h2>
            <div className="space-y-6">
              {data.topics.map((topic) => (
                <div key={topic.name} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-medium text-gray-800">{topic.name}</h3>
                    <span className="text-sm text-gray-500">{topic.count} 条</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {topic.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <ul className="space-y-2">
                    {topic.items.map((item) => (
                      <li key={item.id} className="text-sm">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Editor Picks */}
        {data.editorPicks.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">编辑精选</h2>
            <ul className="space-y-3">
              {data.editorPicks.map((pick) => (
                <li key={pick.id} className="flex items-start justify-between">
                  <a
                    href={pick.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex-1"
                  >
                    {pick.title}
                  </a>
                  <span className="text-xs text-gray-400 ml-2">
                    {formatDateTime(pick.savedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty State */}
        {data.topics.length === 0 && data.editorPicks.length === 0 && (
          <section className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 text-4xl mb-4">📭</div>
            <p className="text-gray-500">本周暂无内容</p>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * 格式化日期 (YYYY-MM-DD)
 */
function formatDate(isoString: string): string {
  return isoString.split("T")[0];
}

/**
 * 格式化日期时间 (MM-DD HH:MM)
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}
