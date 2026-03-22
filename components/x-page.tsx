"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Settings, ChevronLeft, ChevronRight } from "lucide-react"
import { TweetCard } from "@/components/tweet-card"
import { TweetListSkeleton } from "@/components/loading-skeletons"
import { useTweets } from "@/hooks/use-tweets"
import { useXConfig } from "@/hooks/use-x-config"
import type { XTab } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const TABS: Array<{ id: XTab; label: string }> = [
  { id: "bookmarks", label: "Bookmarks" },
  { id: "likes", label: "Likes" },
  { id: "home", label: "Home" },
  { id: "lists", label: "Lists" },
]

export function XPage() {
  const [activeTab, setActiveTab] = useState<XTab>("bookmarks")
  const [searchInput, setSearchInput] = useState("")
  const searchQueryRef = useRef<NodeJS.Timeout>(undefined);
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // Debounce search input (300ms)
  useEffect(() => {
    if (searchQueryRef.current) clearTimeout(searchQueryRef.current);
    searchQueryRef.current = setTimeout(() => setDebouncedQuery(searchInput), 300);
    return () => {
      if (searchQueryRef.current) clearTimeout(searchQueryRef.current);
    };
  }, [searchInput]);
  const [sortOrder, setSortOrder] = useState<"ranked" | "recent" | "engagement">("ranked")
  const [timeWindow, setTimeWindow] = useState<"today" | "week" | "month">("week")
  const [page, setPage] = useState(1)
  const [showConfig, setShowConfig] = useState(false)

  const { configs } = useXConfig()
  const { items, total, loading, refetch, toggleSave, isSaved } = useTweets({
    tab: activeTab,
    sort: sortOrder,
    window: timeWindow,
    page,
    pageSize: 20,
    searchQuery: debouncedQuery || undefined,
  })

  const totalPages = Math.ceil(total / 20)

  // Reset page when params change
  useEffect(() => {
    setPage(1)
  }, [activeTab, sortOrder, timeWindow])

  // Refetch when params change
  useEffect(() => {
    refetch()
  }, [refetch, activeTab, sortOrder, timeWindow, page, debouncedQuery])

  const currentConfig = configs.find((c) => c.tab === activeTab)
  const effectiveWindow = currentConfig?.timeWindow === "today" || currentConfig?.timeWindow === "month"
    ? (currentConfig.timeWindow as typeof timeWindow)
    : timeWindow
  const effectiveSort = currentConfig?.sortOrder === "recent" || currentConfig?.sortOrder === "engagement"
    ? (currentConfig.sortOrder as typeof sortOrder)
    : sortOrder

  return (
    <div className="flex flex-col h-full">
      {/* Tabs + Filters Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        {/* Pill Tabs */}
        <div className="flex bg-muted rounded-lg p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索推文..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 pl-7 w-40 text-xs"
            />
          </div>
          <select
            value={effectiveWindow}
            onChange={(e) => setTimeWindow(e.target.value as typeof timeWindow)}
            className="h-7 px-2 text-xs border rounded-md bg-background"
          >
            <option value="today">今天</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
          </select>
          <select
            value={effectiveSort}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="h-7 px-2 text-xs border rounded-md bg-background"
          >
            <option value="ranked">AI 排序</option>
            <option value="recent">最新</option>
            <option value="engagement">互动量</option>
          </select>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="配置"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Config Panel (collapsible) */}
      {showConfig && (
        <div className="border-b p-4 bg-muted/30 text-xs text-muted-foreground">
          {currentConfig ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="font-medium text-foreground">状态:</span>{" "}
                {currentConfig.enabled ? "启用" : "禁用"}
              </div>
              <div>
                <span className="font-medium text-foreground">模式:</span> {currentConfig.birdMode}
              </div>
              <div>
                <span className="font-medium text-foreground">数量:</span> {currentConfig.count}
              </div>
              <div>
                <span className="font-medium text-foreground">Enrichment:</span>{" "}
                {currentConfig.enrichEnabled ? "启用" : "禁用"}
              </div>
              <div>
                <span className="font-medium text-foreground">AI 评分:</span>{" "}
                {currentConfig.enrichScoring ? "是" : "否"}
              </div>
              <div>
                <span className="font-medium text-foreground">AI 要点:</span>{" "}
                {currentConfig.enrichKeyPoints ? "是" : "否"}
              </div>
            </div>
          ) : (
            <div>加载配置中...</div>
          )}
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && items.length === 0 ? (
          <TweetListSkeleton />
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">暂无推文</div>
        ) : (
          items.map((tweet) => (
            <TweetCard
              key={tweet.id}
              tweet={tweet}
              isSaved={isSaved(tweet.id)}
              onToggleSave={toggleSave}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-3 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
