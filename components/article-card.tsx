"use client"

import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/format-date"
import { SaveButton } from "@/components/save-button"
import type { Article } from "@/lib/types"

interface ArticleCardProps {
  article: Article
  isSaved: boolean
  onToggleSave: (id: string) => void
  onClick: (article: Article) => void
  variant?: "grid" | "wide" | "compact"
}

export function ArticleCard({ article, isSaved, onToggleSave, onClick, variant = "grid" }: ArticleCardProps) {
  if (variant === "compact") {
    return (
      <div
        role="button"
        tabIndex={0}
        className="group w-full text-left flex gap-4 py-4 border-b border-border/50 hover:bg-accent/30 transition-colors duration-200 px-1 -mx-1 rounded cursor-pointer"
        onClick={() => onClick(article)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(article); } }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-sans font-semibold tracking-wider uppercase text-primary shrink-0">
              {article.source}
            </span>
            <span className="text-xs text-muted-foreground">{formatRelative(article.publishedAt)}</span>
          </div>
          <h3 className="font-sans font-semibold text-sm leading-snug text-foreground group-hover:text-primary transition-colors text-balance">
            {article.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{article.summary}</p>
        </div>
        <SaveButton articleId={article.id} isSaved={isSaved} onToggle={onToggleSave} size="sm" className="shrink-0 mt-1" />
      </div>
    )
  }

  if (variant === "wide") {
    return (
      <div
        role="button"
        tabIndex={0}
        className="group w-full text-left flex flex-col gap-4 p-5 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer animate-card-hover"
        onClick={() => onClick(article)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(article); } }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-sans font-semibold tracking-wider uppercase text-primary">
                {article.source}
              </span>
              <span className="text-xs text-muted-foreground">{formatRelative(article.publishedAt)}</span>
            </div>
            <h3 className="font-serif text-lg font-bold leading-snug text-foreground group-hover:text-primary transition-colors text-balance">
              {article.title}
            </h3>
          </div>
          <SaveButton articleId={article.id} isSaved={isSaved} onToggle={onToggleSave} size="md" className="shrink-0" />
        </div>
        <p className="text-sm font-sans text-muted-foreground leading-relaxed">{article.summary}</p>
      </div>
    )
  }

  // grid variant
  return (
    <div
      role="button"
      tabIndex={0}
      className="group w-full text-left flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg transition-all duration-300 cursor-pointer animate-card-hover"
      onClick={() => onClick(article)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(article); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-sans font-semibold tracking-wider uppercase text-primary">
              {article.source}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatRelative(article.publishedAt)}</span>
          </div>
          <h3 className="font-sans font-semibold text-sm leading-snug text-foreground group-hover:text-primary transition-colors text-balance">
            {article.title}
          </h3>
        </div>
        <SaveButton articleId={article.id} isSaved={isSaved} onToggle={onToggleSave} size="sm" className="shrink-0" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{article.summary}</p>
    </div>
  )
}
