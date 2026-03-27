"use client"

import { useEffect } from "react"
import { X, ExternalLink, Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format-date"
import type { Article } from "@/lib/types"
import { SaveButton } from "@/components/save-button"

interface ReadingPanelProps {
  article: Article | null
  open: boolean
  onClose: () => void
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
}

export function ReadingPanel({ article, open, onClose, isSaved, onToggleSave }: ReadingPanelProps) {
  // 键盘关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  // 锁定 body 滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* 遮罩 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* 抽屉 */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-background border-l border-border",
          "flex flex-col transition-transform duration-300 ease-in-out shadow-2xl",
          open ? "translate-x-0" : "translate-x-full"
        )}
        aria-modal="true"
        role="dialog"
        aria-label="文章阅读器"
      >
        {/* 顶部操作栏 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
            {article && (
              <>
                <span className="font-medium text-foreground">{article.source}</span>
                <span>·</span>
                <span>{formatDateTime(article.publishedAt)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {article && (
              <>
                <SaveButton
                  articleId={article.id}
                  isSaved={isSaved(article.id)}
                  onToggle={onToggleSave}
                  size="md"
                />
                <a
                  href={article?.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-accent transition-colors"
                  aria-label="查看原文"
                >
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-accent transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {article && (
            <div className="px-8 py-8 max-w-[650px] mx-auto">
              {/* 来源标签 */}
              <p className="text-xs font-sans font-semibold tracking-widest uppercase text-primary mb-4">
                {article.source}
              </p>

              {/* 大标题 */}
              <h1 className="font-serif text-2xl md:text-3xl font-bold leading-tight text-foreground text-balance mb-6">
                {article.title}
              </h1>

              {/* TL;DR 区块 */}
              <div
                className="mb-8 pl-4 py-4 pr-5 rounded-r-lg"
                style={{
                  borderLeft: "3px solid var(--tldr-border)",
                  background: "var(--bullet-bg)",
                }}
              >
                <p className="text-xs font-sans font-semibold tracking-widest uppercase text-primary mb-2">
                  TL;DR · AI 核心结论
                </p>
                <p className="font-serif text-base leading-relaxed text-foreground">
                  {article.summary}
                </p>
              </div>

              {/* 正文 */}
              <div className="article-body prose-sm">
                {article.content.split("\n\n").map((para, i) => {
                  if (para.startsWith("**") && para.endsWith("**")) {
                    return (
                      <h2 key={i} className="font-sans font-semibold text-lg mt-8 mb-3 text-foreground">
                        {para.replace(/\*\*/g, "")}
                      </h2>
                    )
                  }
                  const isFirst = i === 0
                  return (
                    <p key={i} className={cn("leading-[1.85] text-foreground/90", isFirst && "drop-cap", i > 0 && "mt-5")}>
                      {para.replace(/\*\*(.*?)\*\*/g, "$1")}
                    </p>
                  )
                })}
              </div>

              {/* 底部来源 */}
              <div className="mt-12 pt-6 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-sans">来源</p>
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-sans font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {article.source}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <SaveButton
                  articleId={article.id}
                  isSaved={isSaved(article.id)}
                  onToggle={onToggleSave}
                  size="md"
                  className="border border-border"
                />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
