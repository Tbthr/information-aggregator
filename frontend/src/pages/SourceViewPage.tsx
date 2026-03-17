import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SourceCompositionChart } from "../components/charts/SourceCompositionChart";
import { FilterReasonsChart } from "../components/charts/FilterReasonsChart";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

/**
 * 来源详情数据结构
 */
interface SourceDetailData {
  source: {
    id: string;
    type: string;
    url: string;
    description?: string;
    enabled: boolean;
    packId?: string;
  };
  policy: {
    mode: "assist_only" | "filter_then_assist";
    filterPrompt?: string;
  };
  stats: {
    totalItems: number;
    retainedItems: number;
    retentionRate: number;
  };
  filterReasons: Array<{
    reason: string;
    count: number;
  }>;
  recentItems: Array<{
    id: string;
    title: string;
    url: string;
    publishedAt?: string;
    keepDecision?: boolean;
    keepReason?: string;
    readerBenefit?: string;
    readingHint?: string;
  }>;
}

/**
 * SourceViewPage - 来源详情页面
 * 显示来源元信息、策略模式、保留率、过滤理由分布
 */
export function SourceViewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SourceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchSourceDetail() {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/sources/${id}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch source detail");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    fetchSourceDetail();
  }, [id]);

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
        <div className="text-gray-500">来源不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <header className="mb-6">
          <a href="/" className="text-blue-600 hover:underline text-sm">
            ← 返回首页
          </a>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            来源详情: {data.source.type}
          </h1>
        </header>

        {/* Source Meta */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">来源信息</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">ID</dt>
              <dd className="text-gray-900 font-mono">{data.source.id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">类型</dt>
              <dd className="text-gray-900">{data.source.type}</dd>
            </div>
            <div>
              <dt className="text-gray-500">URL</dt>
              <dd className="text-gray-900 break-all">{data.source.url}</dd>
            </div>
            <div>
              <dt className="text-gray-500">状态</dt>
              <dd className={data.source.enabled ? "text-green-600" : "text-red-600"}>
                {data.source.enabled ? "启用" : "禁用"}
              </dd>
            </div>
            {data.source.packId && (
              <div>
                <dt className="text-gray-500">所属 Pack</dt>
                <dd className="text-gray-900">{data.source.packId}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Policy */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">策略配置</h2>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded ${
                data.policy.mode === "assist_only"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              {data.policy.mode === "assist_only" ? "仅辅助" : "过滤后辅助"}
            </span>
          </div>
          {data.policy.filterPrompt && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">过滤提示：</span>
              {data.policy.filterPrompt}
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">近 7 天统计</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{data.stats.totalItems}</div>
              <div className="text-sm text-gray-500">总内容数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.stats.retainedItems}</div>
              <div className="text-sm text-gray-500">保留内容</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(data.stats.retentionRate * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">保留率</div>
            </div>
          </div>
        </section>

        {/* Filter Reasons Chart */}
        {data.filterReasons.length > 0 && (
          <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">过滤理由分布</h2>
            <FilterReasonsChart data={data.filterReasons} />
          </section>
        )}

        {/* Recent Items */}
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近内容</h2>
          {data.recentItems.length === 0 ? (
            <p className="text-gray-500 text-sm">暂无内容</p>
          ) : (
            <ul className="space-y-3">
              {data.recentItems.map((item) => (
                <li
                  key={item.id}
                  className={`border-l-2 pl-3 ${
                    item.keepDecision === false ? "border-red-300" : "border-green-300"
                  }`}
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm font-medium"
                  >
                    {item.title}
                  </a>
                  {item.keepReason && (
                    <div className="text-xs text-gray-500 mt-1">{item.keepReason}</div>
                  )}
                  {item.readerBenefit && (
                    <div className="text-xs text-green-700 mt-1">💡 {item.readerBenefit}</div>
                  )}
                  {item.readingHint && (
                    <div className="text-xs text-blue-700 mt-1">📖 {item.readingHint}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
