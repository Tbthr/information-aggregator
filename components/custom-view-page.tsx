"use client"

import { useState, useEffect } from "react"
import { Coffee, Zap } from "lucide-react"
import { ArticleCard } from "@/components/article-card"
import { ArticleListSkeleton } from "@/components/loading-skeletons"
import type { Article, CustomView } from "@/lib/types"
import { fetchCustomViews, fetchCustomViewItems, fetchTopics } from "@/lib/api-client"

interface CustomViewPageProps {
  viewId: string
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  coffee: ({ className }) => <Coffee className={className} />,
  zap: ({ className }) => <Zap className={className} />,
}

export function CustomViewPage({ viewId, isSaved, onToggleSave, onOpenArticle }: CustomViewPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<CustomView | null>(null)
  const [topicNames, setTopicNames] = useState<string[]>([])
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        // Fetch custom views and topics in parallel
        const [views, topics] = await Promise.all([fetchCustomViews(), fetchTopics()])
        const foundView = views.find((v) => v.id === viewId)

        if (!mounted) return

        if (!foundView) {
          setError("View not found")
          setLoading(false)
          return
        }

        // Resolve topic names from topicIds
        const names = (foundView.topicIds || [])
          .map((id) => topics.find((t) => t.id === id)?.name)
          .filter(Boolean) as string[]
        setTopicNames(names)

        // Convert view metadata to CustomView format
        const customView: CustomView = {
          id: foundView.id,
          name: foundView.name,
          icon: foundView.icon,
          description: foundView.description,
          articles: [],
        }
        setView(customView)

        // Fetch items for this view
        const result = await fetchCustomViewItems(viewId)

        if (!mounted) return

        setArticles(result.items)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load data")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [viewId])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="py-8">
          <ArticleListSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-destructive font-sans text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!view) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-muted-foreground font-sans text-sm">视图未找到</div>
        </div>
      </div>
    )
  }

  const Icon = ICON_MAP[view.icon] ?? ICON_MAP["zap"]

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* 页面头部 */}
      <div className="mb-8 pb-6 border-b border-border">
        {/* 第一行：视图名称 */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--bullet-bg)" }}
          >
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground">{view.name}</h1>
        </div>

        {/* Topic list */}
        {topicNames.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-12">
            {topicNames.map((name) => (
                <span
                  key={name}
                  className="inline-block text-[10px] font-sans font-medium px-2 py-0.5 rounded border border-border text-muted-foreground"
                >
                  {name}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* 文章流 */}
      <div className="space-y-4">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            isSaved={isSaved(article.id)}
            onToggleSave={onToggleSave}
            onClick={onOpenArticle}
            variant="wide"
          />
        ))}
      </div>

      {/* 空状态提示 */}
      {articles.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground font-sans text-sm">暂无文章，请在引擎配置中添加数据源</p>
        </div>
      )}
    </div>
  )
}
