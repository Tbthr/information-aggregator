import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import { api } from "../lib/api";
import type { PackDetailData, ApiResponse } from "../types/api";

/**
 * Pack 详情页面
 * 显示 policy 摘要、来源构成、代表内容
 */
export function PackViewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ApiResponse<PackDetailData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await api.getPack(id);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // 加载状态
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">加载中...</div>
        </div>
      </Layout>
    );
  }

  // 错误状态
  if (error || !data?.data) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="text-red-500">
            加载失败: {error?.message || "数据不存在"}
          </div>
          <Link to="/items" className="text-blue-500 hover:underline">
            返回列表
          </Link>
        </div>
      </Layout>
    );
  }

  const pack = data.data;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* 返回链接 */}
        <Link to="/items" className="text-blue-500 hover:underline text-sm mb-4 inline-block">
          &larr; 返回列表
        </Link>

        {/* Pack 标题 */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {pack.pack.name}
          </h1>
          {pack.pack.description && (
            <p className="text-gray-600">{pack.pack.description}</p>
          )}
        </header>

        {/* 统计摘要 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">来源数</div>
              <div className="text-xl font-semibold text-gray-900">
                {pack.stats.sourceCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">总条目</div>
              <div className="text-xl font-semibold text-gray-900">
                {pack.stats.totalItems}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">保留条目</div>
              <div className="text-xl font-semibold text-gray-900">
                {pack.stats.retainedItems}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-sm text-gray-500">保留率</div>
              <div className="text-xl font-semibold text-gray-900">
                {(pack.stats.retentionRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </section>

        {/* Policy 摘要 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">策略配置</h2>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-500">模式:</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                {pack.policy.mode === 'assist_only' ? 'AI 辅助' : '过滤 + AI'}
              </span>
            </div>
            {pack.policy.filterPrompt && (
              <div className="mt-3">
                <span className="text-sm text-gray-500">过滤提示词:</span>
                <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded text-sm">
                  {pack.policy.filterPrompt}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 来源构成 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">来源构成</h2>
          {Object.keys(pack.sourceComposition).length > 0 ? (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="space-y-3">
                {Object.entries(pack.sourceComposition).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-gray-700">{type}</span>
                    <span className="text-gray-500">{count} 个来源</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">暂无来源</div>
          )}
        </section>

        {/* 代表内容 */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">代表内容</h2>
          {pack.featuredItems.length > 0 ? (
            <div className="space-y-4">
              {pack.featuredItems.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {item.title}
                  </a>
                  {item.snippet && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {item.snippet}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    {item.author && <span>作者: {item.author}</span>}
                    {item.publishedAt && (
                      <span>
                        {new Date(item.publishedAt).toLocaleDateString("zh-CN")}
                      </span>
                    )}
                    <span>分数: {item.score.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">暂无代表内容</div>
          )}
        </section>
      </div>
    </Layout>
  );
}
