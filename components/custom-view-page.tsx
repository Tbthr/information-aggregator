"use client"

import { useState, useEffect } from "react"
import { Coffee, Zap } from "lucide-react"
import { ArticleCard } from "@/components/article-card"
import type { Article, CustomView } from "@/lib/types"
import { fetchCustomViews, fetchCustomViewItems } from "@/lib/api-client"

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

// Pack type from API response
type ViewPack = { packId: string; pack?: { id: string; name: string } }

export function CustomViewPage({ viewId, isSaved, onToggleSave, onOpenArticle }: CustomViewPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<CustomView | null>(null)
  const [viewPacks, setViewPacks] = useState<ViewPack[]>([])
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        // Fetch custom views list first
        const views = await fetchCustomViews()
        const foundView = views.find((v) => v.id === viewId)

        if (!mounted) return

        if (!foundView) {
          setError("View not found")
          setLoading(false)
          return
        }

        // Save packs data for display
        setViewPacks(foundView.packs || [])

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
        <div className="flex items-center justify-center py-24">
          <div className="text-muted-foreground font-sans text-sm">加载中...</div>
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

        {/* 第二行：Pack 列表 */}
        {viewPacks.length > 0 && (
          <div className="flex flex-wrap gap-2 ml-12">
            {viewPacks.map((p) =>
              p.pack ? (
                <span
                  key={p.packId}
                  className="inline-block text-[10px] font-sans font-medium px-2 py-0.5 rounded border border-border text-muted-foreground"
                >
                  {p.pack.name}
                </span>
              ) : null
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
