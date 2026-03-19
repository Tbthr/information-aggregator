"use client"

import { Coffee, Zap } from "lucide-react"
import { ArticleCard } from "@/components/article-card"
import type { Article, CustomView } from "@/lib/types"
import { CUSTOM_VIEWS } from "@/lib/mock-data"

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
  const view = CUSTOM_VIEWS.find((v) => v.id === viewId) ?? CUSTOM_VIEWS[0]
  const Icon = ICON_MAP[view.icon] ?? ICON_MAP["zap"]

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* 页面头部 */}
      <div className="mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "var(--bullet-bg)" }}
          >
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{view.name}</h1>
            <p className="text-xs text-muted-foreground font-sans">{view.description}</p>
          </div>
        </div>
      </div>

      {/* 文章流 */}
      <div className="space-y-4">
        {view.articles.map((article) => (
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
      {view.articles.length === 0 && (
        <div className="text-center py-20">
          <p className="text-muted-foreground font-sans text-sm">暂无文章，请在引擎配置中添加数据源</p>
        </div>
      )}
    </div>
  )
}
