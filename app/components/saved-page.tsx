"use client"

import { Bookmark, ExternalLink } from "lucide-react"
import { SaveButton } from "@/components/save-button"
import type { Article } from "@/lib/mock-data"
import { SPOTLIGHT_ARTICLES, RECOMMENDED_ARTICLES, DEEP_DIVES, CUSTOM_VIEWS } from "@/lib/mock-data"

const ALL_ARTICLES: Article[] = [
  ...SPOTLIGHT_ARTICLES,
  ...RECOMMENDED_ARTICLES,
  ...DEEP_DIVES,
  ...CUSTOM_VIEWS.flatMap((v) => v.articles),
]

interface SavedPageProps {
  savedIds: Set<string>
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}

export function SavedPage({ savedIds, isSaved, onToggleSave, onOpenArticle }: SavedPageProps) {
  const savedArticles = ALL_ARTICLES.filter((a) => savedIds.has(a.id))

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Bookmark className="w-5 h-5 text-primary" />
          <h1 className="font-serif text-2xl font-bold text-foreground">我的收藏夹</h1>
        </div>
        <p className="text-xs text-muted-foreground font-sans">{savedArticles.length} 篇已保存</p>
      </div>

      {savedArticles.length === 0 ? (
        <div className="text-center py-24 space-y-3">
          <Bookmark className="w-10 h-10 text-border mx-auto" />
          <p className="text-muted-foreground font-sans text-sm">还没有收藏，点击文章旁的书签图标开始收藏</p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedArticles.map((article) => (
            <div
              key={article.id}
              role="button"
              tabIndex={0}
              className="group w-full text-left flex gap-4 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-accent/20 transition-all duration-200 bg-card cursor-pointer"
              onClick={() => onOpenArticle(article)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenArticle(article); } }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-sans font-semibold tracking-wider uppercase text-primary shrink-0">
                    {article.source}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{article.publishedAt}</span>
                </div>
                <h3 className="font-serif font-bold text-base leading-snug text-foreground group-hover:text-primary transition-colors text-balance">
                  {article.title}
                </h3>
                <p className="mt-1.5 text-xs text-muted-foreground font-sans leading-relaxed line-clamp-2">
                  {article.summary}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <SaveButton
                  articleId={article.id}
                  isSaved={isSaved(article.id)}
                  onToggle={onToggleSave}
                  size="sm"
                />
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-accent transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
