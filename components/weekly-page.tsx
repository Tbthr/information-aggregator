"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ArticleListSkeleton } from "@/components/loading-skeletons"
import { SaveButton } from "@/components/save-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useWeekly } from "@/hooks/use-api"
import type { Article, WeeklyPick, ReferencedItem } from "@/lib/types"

interface WeeklyPageProps {
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}

// ISO week helper: compute the week number for a given date (UTC)
function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Get the Monday of a given ISO week (UTC)
function getMondayOfWeek(year: number, week: number): Date {
  // January 4th is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const monday = new Date(Date.UTC(year, 0, 4 - (dayOfWeek - 1) + (week - 1) * 7))
  return monday
}

// Get the ISO week string for a date
function getWeekString(date: Date): string {
  const year = date.getUTCFullYear()
  const week = getIsoWeek(date)
  return `${year}-W${String(week).padStart(2, "0")}`
}

// Navigate to adjacent week
function getAdjacentWeek(weekNumber: string, direction: -1 | 1): string {
  const [yearStr, weekStr] = weekNumber.split("-W")
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekStr, 10)
  const monday = getMondayOfWeek(year, week)
  monday.setUTCDate(monday.getUTCDate() + direction * 7)
  return getWeekString(monday)
}

// Get current week string
function getCurrentWeek(): string {
  return getWeekString(new Date())
}

// Score badge
function ScoreBadge({ score }: { score: number }) {
  return (
    <Badge variant="outline" className="text-[10px] font-sans font-semibold gap-1 px-2 py-0.5 rounded-full">
      <span style={{ color: "var(--save-active)" }}>★</span>
      {score.toFixed(1)}
    </Badge>
  )
}

// Pick card
function PickCard({
  pick,
  item,
  rank,
  isSaved,
  onToggleSave,
  onOpenArticle,
}: {
  pick: WeeklyPick
  item: ReferencedItem | undefined
  rank: number
  isSaved: boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}) {
  const isDeleted = !item

  return (
    <Card className="border-border rounded-2xl py-0 gap-0 overflow-hidden hover:border-primary/50 hover:shadow-md transition-all animate-card-hover">
      <CardContent className="p-6">
        {/* Top row: rank, score, save */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono text-muted-foreground/60 w-5 shrink-0">
            {String(rank).padStart(2, "0")}
          </span>
          {item && <ScoreBadge score={item.score} />}
          {!isDeleted && (
            <SaveButton
              articleId={pick.itemId}
              isSaved={isSaved}
              onToggle={onToggleSave}
              size="sm"
              className="shrink-0"
            />
          )}
        </div>

        {/* Title */}
        <h3
          className={`font-serif text-lg font-bold leading-snug text-foreground text-balance mb-2 ${
            !isDeleted ? "group-hover:text-primary transition-colors" : "text-muted-foreground"
          }`}
        >
          {isDeleted ? "[内容已删除]" : item.title}
        </h3>

        {/* Summary */}
        {item && item.summary && (
          <p className="text-sm font-sans text-muted-foreground leading-relaxed mb-4">
            {item.summary}
          </p>
        )}

        {/* AI recommendation reason */}
        <div className="border-l-2 pl-4 py-1" style={{ borderColor: "var(--tldr-border)" }}>
          <p className="text-[10px] font-sans font-semibold tracking-widest uppercase text-primary mb-1">
            推荐理由
          </p>
          <p className="text-sm font-serif text-foreground/80 leading-relaxed">
            {pick.reason}
          </p>
        </div>

        {/* External link */}
        {item && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-3 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            查看原文
          </a>
        )}
      </CardContent>
    </Card>
  )
}

export function WeeklyPage({ isSaved, onToggleSave, onOpenArticle }: WeeklyPageProps) {
  const currentWeek = useMemo(() => getCurrentWeek(), [])
  const [week, setWeek] = useState(currentWeek)
  const { data, isLoading, error } = useWeekly(week)

  const itemMap = useMemo(() => {
    const map = new Map<string, ReferencedItem>()
    if (data?.referencedItems) {
      for (const item of data.referencedItems) {
        map.set(item.id, item)
      }
    }
    return map
  }, [data?.referencedItems])

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="py-8">
          <ArticleListSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-destructive font-sans text-sm">{error?.message}</div>
        </div>
      </div>
    )
  }

  const weekNumber = data?.weekNumber ?? week
  const editorial = data?.editorial
  const picks = data?.picks ?? []
  const hasError = !!data?.errorMessage

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">

      {/* Week navigation */}
      <section>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeek(getAdjacentWeek(weekNumber, -1))}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            上一周
          </Button>

          <div className="text-center">
            <p className="font-sans text-[10px] font-semibold tracking-widest uppercase text-primary">
              The Weekly
            </p>
            <h1 className="text-xl font-serif font-bold text-foreground mt-0.5">
              {weekNumber}
            </h1>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeek(getAdjacentWeek(weekNumber, 1))}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            下一周
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Error display */}
      {hasError && (
        <Card className="border-destructive/50">
          <CardContent className="p-5">
            <p className="text-sm font-sans font-semibold text-destructive mb-2">
              生成失败
            </p>
            <p className="text-sm font-sans text-muted-foreground">
              {data.errorMessage}
            </p>
            {data.errorSteps && data.errorSteps.length > 0 && (
              <ul className="mt-2 space-y-1">
                {data.errorSteps.map((step, i) => (
                  <li key={i} className="text-xs font-mono text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Editorial — Deep summary */}
      {editorial && (
        <section>
          <div className="mb-6">
            <h2 className="font-sans text-[10px] font-semibold tracking-widest uppercase text-primary">
              Editorial
            </h2>
            <p className="text-xl font-serif font-bold mt-0.5 text-foreground">本周纵览</p>
          </div>

          <div
            className="rounded-2xl px-7 py-6"
            style={{ background: "var(--overview-bg)", color: "var(--overview-foreground)" }}
          >
            <div className="space-y-4 font-serif text-base leading-[1.85] [&>p]:text-foreground/90 [&>p]:my-0 [&>ul]:my-2 [&>ul]:pl-6 [&>ol]:my-2 [&>ol]:pl-6 [&>li]:my-1 [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:text-xl [&>h2]:font-bold [&>h3]:text-lg [&>h3]:font-bold [&>a]:text-primary [&>a]:underline hover:[&>a]:text-primary/80 [&>strong]:font-bold [&>em]:italic [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>pre]:bg-muted [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>blockquote]:border-l-4 [&>blockquote]:border-primary/50 [&>blockquote]:pl-4 [&>blockquote]:italic">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editorial}
              </ReactMarkdown>
            </div>
          </div>
        </section>
      )}

      {/* Curated picks */}
      <section>
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h2 className="font-sans text-[10px] font-semibold tracking-widest uppercase text-primary">
              Curated Picks
            </h2>
            <p className="text-xl font-serif font-bold mt-0.5 text-foreground">本周精选</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{picks.length} 篇</span>
        </div>

        {picks.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-muted-foreground font-sans text-sm">
              {editorial ? "本周暂无精选内容" : "暂无数据"}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {picks.map((pick, i) => (
              <div
                key={pick.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
              >
                <PickCard
                  pick={pick}
                  item={itemMap.get(pick.itemId)}
                  rank={i + 1}
                  isSaved={isSaved(pick.itemId)}
                  onToggleSave={onToggleSave}
                  onOpenArticle={onOpenArticle}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
