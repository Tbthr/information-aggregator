"use client"

import { useMemo, useState } from "react"
import { ArticleListSkeleton } from "@/components/loading-skeletons"
import { SaveButton } from "@/components/save-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { Article, DigestTopic, ReferencedItem, ReferencedTweet } from "@/lib/types"
import { useDaily } from "@/hooks/use-api"

// ── Icons (inline to avoid adding deps) ──

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
    </svg>
  )
}

// ── Score badge ──

function ScoreBadge({ score }: { score?: number | null }) {
  if (!score) return null
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: "var(--bullet-bg)", color: "var(--accent-foreground)" }}
    >
      <span style={{ color: "var(--save-active)" }}>&#9733;</span>
      {score.toFixed(1)}
    </span>
  )
}

// ── Date helpers ──

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${weekdays[d.getUTCDay()]}`
}

function getTodayStr(): string {
  const now = new Date()
  // Use Beijing time (UTC+8) for "today"
  const beijingOffset = 8 * 60 * 60 * 1000
  const beijingTime = new Date(now.getTime() + beijingOffset)
  const y = beijingTime.getUTCFullYear()
  const m = String(beijingTime.getUTCMonth() + 1).padStart(2, "0")
  const day = String(beijingTime.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// ── Reference link row ──

function ReferenceLinkRow({
  item,
  isSaved,
  onToggleSave,
  onOpenArticle,
}: {
  item: ReferencedItem
  isSaved: boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}) {
  return (
    <div className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/60 transition-colors">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-sans text-foreground leading-snug truncate group-hover:text-primary transition-colors">
          {item.title}
        </p>
        {item.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
            {item.summary}
          </p>
        )}
      </a>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <ScoreBadge score={item.score} />
        <SaveButton
          articleId={item.id}
          isSaved={isSaved}
          onToggle={onToggleSave}
          size="sm"
          className="shrink-0"
        />
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLinkIcon />
        </a>
      </div>
    </div>
  )
}

function TweetReferenceRow({ tweet }: { tweet: ReferencedTweet }) {
  const displayText = tweet.text
    ? tweet.text.length > 100
      ? tweet.text.slice(0, 100) + "..."
      : tweet.text
    : null

  return (
    <div className="group flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/60 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-primary mb-1">@{tweet.authorHandle}</p>
        {displayText && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {displayText}
          </p>
        )}
      </div>
      {tweet.tweetUrl && (
        <a
          href={tweet.tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors shrink-0 mt-1"
        >
          <ExternalLinkIcon />
        </a>
      )}
    </div>
  )
}

function DeletedReferenceRow() {
  return (
    <div className="flex items-center gap-2 py-2.5 px-3 text-muted-foreground/60 text-xs font-sans">
      <span>[内容已删除]</span>
    </div>
  )
}

// ── Topic card ──

function TopicCard({
  topic,
  itemMap,
  tweetMap,
  isSaved,
  onToggleSave,
  onOpenArticle,
}: {
  topic: DigestTopic
  itemMap: Map<string, ReferencedItem>
  tweetMap: Map<string, ReferencedTweet>
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  const totalRefs = topic.itemIds.length + topic.tweetIds.length

  return (
    <div
      className="animate-fade-in-up border border-border rounded-2xl bg-card overflow-hidden"
    >
      {/* Topic header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <span className="text-[10px] font-mono text-muted-foreground/60 mt-1 shrink-0">
            {String(topic.order + 1).padStart(2, "0")}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-lg font-bold leading-tight text-foreground text-balance mb-2">
              {topic.title}
            </h3>
            <p className="text-sm font-sans text-muted-foreground leading-relaxed">
              {topic.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible references */}
      {totalRefs > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="border-t border-border">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-muted/40 transition-colors text-xs font-sans text-muted-foreground">
              <span>参考来源 ({totalRefs})</span>
              <ChevronDownIcon
                className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-2 space-y-0.5">
                {topic.itemIds.map((id) => {
                  const item = itemMap.get(id)
                  if (!item) return <DeletedReferenceRow key={`item-${id}`} />
                  return (
                    <ReferenceLinkRow
                      key={id}
                      item={item}
                      isSaved={isSaved(id)}
                      onToggleSave={onToggleSave}
                      onOpenArticle={onOpenArticle}
                    />
                  )
                })}
                {topic.tweetIds.map((id) => {
                  const tweet = tweetMap.get(id)
                  if (!tweet) return <DeletedReferenceRow key={`tweet-${id}`} />
                  return <TweetReferenceRow key={id} tweet={tweet} />
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  )
}

// ── Main page component ──

interface DailyPageProps {
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}

export function DailyPage({ isSaved, onToggleSave, onOpenArticle }: DailyPageProps) {
  const [currentDate, setCurrentDate] = useState(getTodayStr)
  const { data, isLoading, error } = useDaily(currentDate)

  const topics = data?.topics ?? []
  const dayLabel = data?.dayLabel ?? ""
  const errorMessage = data?.errorMessage
  const errorSteps = data?.errorSteps

  // Build lookup maps for referenced items/tweets
  const { itemMap, tweetMap } = useMemo(() => {
    const iMap = new Map<string, ReferencedItem>()
    const tMap = new Map<string, ReferencedTweet>()
    for (const item of data?.referencedItems ?? []) {
      iMap.set(item.id, item)
    }
    for (const tweet of data?.referencedTweets ?? []) {
      tMap.set(tweet.id, tweet)
    }
    return { itemMap: iMap, tweetMap: tMap }
  }, [data?.referencedItems, data?.referencedTweets])

  // Navigation handlers
  const goPrev = () => setCurrentDate((d) => shiftDate(d, -1))
  const goNext = () => setCurrentDate((d) => shiftDate(d, 1))
  const goToday = () => setCurrentDate(getTodayStr)

  const isToday = currentDate === getTodayStr()

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

  // No data state
  if (topics.length === 0 && !errorMessage) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Date navigation */}
        <nav className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={goPrev}>
            <ChevronLeftIcon className="mr-1" />
            前一天
          </Button>
          <button onClick={goToday} className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors">
            {formatDisplayDate(currentDate)}
          </button>
          <Button variant="ghost" size="sm" onClick={goNext} disabled={isToday}>
            后一天
            <ChevronRightIcon className="ml-1" />
          </Button>
        </nav>

        <div className="flex items-center justify-center py-24">
          <div className="text-muted-foreground font-sans text-sm">暂无日报数据</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">

      {/* Date navigation */}
      <nav className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goPrev}>
          <ChevronLeftIcon className="mr-1" />
          前一天
        </Button>
        <div className="text-center">
          <button
            onClick={goToday}
            className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {formatDisplayDate(currentDate)}
          </button>
          {dayLabel && !isToday && (
            <p className="text-[10px] text-muted-foreground/60 font-sans">{dayLabel}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={goNext} disabled={isToday}>
          后一天
          <ChevronRightIcon className="ml-1" />
        </Button>
      </nav>

      {/* Error banner */}
      {errorMessage && (
        <section>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-4">
            <p className="text-sm font-sans text-destructive font-semibold mb-1">生成失败</p>
            <p className="text-xs font-sans text-muted-foreground">{errorMessage}</p>
            {errorSteps && errorSteps.length > 0 && (
              <ul className="mt-2 space-y-1">
                {errorSteps.map((step, i) => (
                  <li key={i} className="text-xs font-mono text-muted-foreground/70">
                    {i + 1}. {step}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Topic digest */}
      {topics.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h2 className="font-sans text-[10px] font-semibold tracking-widest uppercase text-primary">
                Topic Digest
              </h2>
              <p className="text-xl font-serif font-bold mt-0.5 text-foreground">主题摘要</p>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {topics.length} 个主题
            </Badge>
          </div>

          <div className="space-y-4">
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                itemMap={itemMap}
                tweetMap={tweetMap}
                isSaved={isSaved}
                onToggleSave={onToggleSave}
                onOpenArticle={onOpenArticle}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
