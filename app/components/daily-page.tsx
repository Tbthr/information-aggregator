"use client"

import { cn } from "@/lib/utils"
import { SaveButton } from "@/components/save-button"
import type { Article } from "@/lib/mock-data"
import {
  DAILY_OVERVIEW,
  SPOTLIGHT_ARTICLES,
  RECOMMENDED_ARTICLES,
  NEWS_FLASHES,
} from "@/lib/mock-data"

interface DailyPageProps {
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}

// 评分渲染：保留一位小数，带星号
function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: "var(--bullet-bg)", color: "var(--accent-foreground)" }}
    >
      <span style={{ color: "var(--save-active)" }}>★</span>
      {score.toFixed(1)}
    </span>
  )
}

// 标签渲染
function CategoryTag({ category }: { category?: string }) {
  if (!category) return null
  return (
    <span className="inline-block text-[10px] font-sans font-medium px-2 py-0.5 rounded border border-border text-muted-foreground">
      {category}
    </span>
  )
}

// 单条纵向 Feed 卡片
function FeedCard({
  article,
  isSaved,
  onToggleSave,
  onOpenArticle,
  rank,
}: {
  article: Article
  isSaved: boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
  rank?: number
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="group w-full text-left border border-border rounded-2xl p-6 hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card cursor-pointer"
      onClick={() => onOpenArticle(article)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenArticle(article)
        }
      }}
    >
      {/* 顶行：来源 · 时间 · 评分 · 收藏 */}
      <div className="flex items-center gap-2 mb-3">
        {rank !== undefined && (
          <span className="text-[10px] font-mono text-muted-foreground/60 w-5 shrink-0">
            {String(rank).padStart(2, "0")}
          </span>
        )}
        <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-primary">
          {article.source}
        </span>
        <span className="text-muted-foreground/50 text-[10px]">·</span>
        <span className="text-[10px] font-mono text-muted-foreground">{article.publishedAt}</span>
        <div className="ml-auto flex items-center gap-2">
          <ScoreBadge score={article.aiScore} />
          <SaveButton
            articleId={article.id}
            isSaved={isSaved}
            onToggle={onToggleSave}
            size="sm"
            className="shrink-0"
          />
        </div>
      </div>

      {/* 大标题 Serif */}
      <h3 className="font-serif text-[1.25rem] font-bold leading-[1.4] text-foreground group-hover:text-primary transition-colors text-balance mb-3">
        {article.title}
      </h3>

      {/* 精炼概述 */}
      <p className="text-sm font-sans text-muted-foreground leading-relaxed mb-4">
        {article.summary}
      </p>

      {/* 核心要点 */}
      {article.bullets && article.bullets.length > 0 && (
        <ul
          className="space-y-1.5 rounded-xl px-4 py-3 mb-4"
          style={{ background: "var(--bullet-bg)" }}
        >
          {article.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs font-sans" style={{ color: "var(--accent-foreground)" }}>
              <span className="text-primary shrink-0 font-bold">›</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 底行：标签 */}
      <div className="flex items-center gap-2">
        {article.category && <CategoryTag category={article.category} />}
      </div>
    </div>
  )
}

export function DailyPage({ isSaved, onToggleSave, onOpenArticle }: DailyPageProps) {
  // 合并 Spotlight + Recommended，Spotlight 排在前面
  const allArticles = [...SPOTLIGHT_ARTICLES, ...RECOMMENDED_ARTICLES]

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">

      {/* 日报概括 — The Overview */}
      <section>
        <div
          className="rounded-2xl px-7 py-6"
          style={{ background: "var(--overview-bg)", color: "var(--overview-foreground)" }}
        >
          <p
            className="text-[10px] font-sans font-semibold tracking-widest uppercase mb-3"
            style={{ color: "var(--spotlight-accent)" }}
          >
            The Daily Overview
          </p>
          <p className="text-[11px] font-mono mb-4" style={{ color: "oklch(0.7 0.01 260)" }}>
            {DAILY_OVERVIEW.date}
          </p>
          <p
            className="font-serif text-base leading-[1.8] text-balance"
            style={{ color: "var(--overview-foreground)" }}
          >
            {DAILY_OVERVIEW.summary}
          </p>
        </div>
      </section>

      {/* 合并 Feed 流 — Today's Reads */}
      <section>
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h2 className="font-sans text-[10px] font-semibold tracking-widest uppercase text-primary">
              Today's Reads
            </h2>
            <p className="text-xl font-serif font-bold mt-0.5 text-foreground">今日精选</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{allArticles.length} 篇</span>
        </div>

        <div className="space-y-4">
          {allArticles.map((article, i) => (
            <FeedCard
              key={article.id}
              article={article}
              isSaved={isSaved(article.id)}
              onToggleSave={onToggleSave}
              onOpenArticle={onOpenArticle}
              rank={i + 1}
            />
          ))}
        </div>
      </section>

      {/* 快讯清单 — News Flashes */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h2 className="font-sans text-[10px] font-semibold tracking-widest uppercase text-primary">
              News Flashes
            </h2>
            <p className="text-xl font-serif font-bold mt-0.5 text-foreground">快讯清单</p>
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          {NEWS_FLASHES.map((flash, i) => (
            <div
              key={flash.id}
              className={cn(
                "flex items-baseline gap-4 px-5 py-3 font-sans",
                i % 2 === 0 ? "bg-muted/40" : "bg-card"
              )}
            >
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-10">
                {flash.time}
              </span>
              <span className="text-muted-foreground/50 text-xs shrink-0">·</span>
              <p className="text-sm text-foreground leading-snug">{flash.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
