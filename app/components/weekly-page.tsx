"use client"

import { useState, useEffect } from "react"
import { SaveButton } from "@/components/save-button"
import type { Article, TimelineEvent, WeeklyReport } from "@/lib/types"
import { fetchWeeklyReport } from "@/lib/api-client"

interface WeeklyPageProps {
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}

export function WeeklyPage({ isSaved, onToggleSave, onOpenArticle }: WeeklyPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hero, setHero] = useState<WeeklyReport | null>(null)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [deepDives, setDeepDives] = useState<Article[]>([])

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchWeeklyReport()

        if (!mounted) return

        if (data) {
          setHero(data.hero)
          setTimelineEvents(data.timelineEvents)
          setDeepDives(data.deepDives)
        }
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
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-muted-foreground font-sans text-sm">加载中...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-destructive font-sans text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!hero) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-muted-foreground font-sans text-sm">暂无数据</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-14">

      {/* Hero — 封面与卷首语 */}
      <section className="border-b border-border pb-12">
        <div className="mb-2">
          <span className="text-xs font-sans font-semibold tracking-widest uppercase text-primary">
            The Weekly · {hero.subheadline}
          </span>
        </div>
        <h1 className="font-serif text-5xl md:text-6xl font-bold leading-none tracking-tight text-foreground text-balance my-5">
          {hero.weekNumber}
          <br />
          <span className="text-primary">{hero.headline}</span>
        </h1>

        {/* 分栏首字下沉卷首语 */}
        <div className="mt-8 md:columns-2 gap-8">
          {hero.editorial.split("\n\n").map((para, i) => (
            <p
              key={i}
              className={`font-serif text-base leading-[1.85] text-foreground/85 mb-5 break-inside-avoid ${i === 0 ? "drop-cap" : ""}`}
            >
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* 本周大事件脉络 — Timeline */}
      <section>
        <div className="mb-6">
          <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-primary">The Big Picture</h2>
          <p className="text-xl font-serif font-bold mt-0.5 text-foreground">本周大事件脉络</p>
        </div>

        <div className="relative">
          {/* 时间轴竖线 */}
          <div
            className="absolute left-[72px] top-2 bottom-2 w-px"
            style={{ background: "var(--border)" }}
          />

          <div className="space-y-6">
            {timelineEvents.map((event, i) => (
              <div key={event.id} className="flex gap-6">
                {/* 日期标签 */}
                <div className="shrink-0 w-[72px] text-right pr-4 relative">
                  <div
                    className="absolute right-0 top-[22px] w-2.5 h-2.5 rounded-full border-2 translate-x-[calc(50%+1px)] -translate-y-1/2 bg-background"
                    style={{ borderColor: i === timelineEvents.length - 1 ? "var(--primary)" : "var(--border)" }}
                  />
                  <p className="text-[10px] font-mono font-bold text-muted-foreground">{event.date}</p>
                  <p className="text-[10px] font-sans text-muted-foreground">{event.dayLabel}</p>
                </div>
                {/* 内容 */}
                <div className="flex-1 pb-2">
                  <h3 className="font-sans font-semibold text-sm text-foreground leading-snug mb-1">
                    {event.title}
                  </h3>
                  <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                    {event.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 周末深度精选 — Deep Dives */}
      <section>
        <div className="mb-6">
          <h2 className="font-sans text-xs font-semibold tracking-widest uppercase text-primary">Deep Dives</h2>
          <p className="text-xl font-serif font-bold mt-0.5 text-foreground">周末深度精选</p>
        </div>

        <div className="space-y-6">
          {deepDives.map((article) => (
            <div
              key={article.id}
              role="button"
              tabIndex={0}
              className="group w-full text-left border border-border rounded-2xl p-7 hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card cursor-pointer"
              onClick={() => onOpenArticle(article)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenArticle(article); } }}
            >
              {/* 顶行：来源 · 时间 · 评分 · 收藏 */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-primary">
                  {article.source}
                </span>
                <span className="text-muted-foreground/50 text-[10px]">·</span>
                <span className="text-[10px] font-mono text-muted-foreground">{article.publishedAt}</span>
                <div className="ml-auto flex items-center gap-2">
                  {article.aiScore && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: "var(--bullet-bg)", color: "var(--accent-foreground)" }}
                    >
                      <span style={{ color: "var(--save-active)" }}>★</span>
                      {article.aiScore.toFixed(1)}
                    </span>
                  )}
                  <SaveButton
                    articleId={article.id}
                    isSaved={isSaved(article.id)}
                    onToggle={onToggleSave}
                    size="md"
                    className="shrink-0"
                  />
                </div>
              </div>
              <h3 className="font-serif text-xl font-bold leading-snug text-foreground group-hover:text-primary transition-colors text-balance mb-4">
                {article.title}
              </h3>

              <p className="text-sm font-sans text-muted-foreground leading-relaxed mb-4">
                {article.summary}
              </p>

              {/* Why it matters */}
              <div className="border-l-2 pl-4 py-1" style={{ borderColor: "var(--tldr-border)" }}>
                <p className="text-[10px] font-sans font-semibold tracking-widest uppercase text-primary mb-1">
                  Why it matters
                </p>
                <p className="text-sm font-serif italic text-foreground/80 leading-relaxed">
                  为什么这篇值得你在周末花 10 分钟阅读？
                </p>
                <ul className="mt-2 space-y-1">
                  {article.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-xs font-sans text-muted-foreground">
                      <span className="text-primary shrink-0">›</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
