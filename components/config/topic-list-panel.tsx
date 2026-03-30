"use client"

import { ChevronDown, ChevronRight, Plus, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Source, TopicConfig } from "./types"

interface TopicListPanelProps {
  topics: TopicConfig[]
  sources: Source[]
  selectedTopic: TopicConfig | null
  expandedTopics: Set<string>
  onSelectTopic: (topic: TopicConfig) => void
  onToggleExpand: (id: string) => void
  onCreateTopic: () => void
  onAddSource: (topicId: string) => void
  onEditSource: (source: Source) => void
}

export function TopicListPanel({
  topics,
  sources,
  selectedTopic,
  expandedTopics,
  onSelectTopic,
  onToggleExpand,
  onCreateTopic,
  onAddSource,
  onEditSource,
}: TopicListPanelProps) {
  return (
    <div className="w-72 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <p className="font-sans font-semibold text-sm text-sidebar-foreground">Topic 与数据源</p>
        <button
          onClick={onCreateTopic}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          新建 Topic
        </button>
      </div>

      <div className="py-2">
        {topics.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            暂无 Topic，点击上方按钮创建
          </div>
        ) : (
          topics.map((topic) => {
            const topicSources = Array.from(
              new Map(
                sources
                  .filter((s) => s.defaultTopicIds?.includes(topic.id))
                  .map((s) => [s.id, s])
              ).values()
            )

            return (
              <div key={topic.id}>
                {/* Topic 行 */}
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-sidebar-accent transition-colors",
                    selectedTopic?.id === topic.id && "bg-sidebar-accent"
                  )}
                  onClick={() => { onSelectTopic(topic); onToggleExpand(topic.id) }}
                >
                  {expandedTopics.has(topic.id) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={cn(
                    "font-sans text-sm truncate",
                    selectedTopic?.id === topic.id ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground/80"
                  )}>
                    {topic.name}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{topicSources.length}</span>
                </button>

                {/* 子源列表 */}
                {expandedTopics.has(topic.id) && (
                  <div className="pl-7 py-1">
                    {topicSources.length === 0 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground">暂无数据源</div>
                    )}
                    {topicSources.map((source) => (
                      <div
                        key={source.id}
                        className="relative group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-sidebar-accent/60 rounded-sm transition-colors"
                        onClick={() => onEditSource(source)}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            source.enabled ? "bg-green-500" : "bg-gray-400"
                          )}
                        />
                        <span className="text-sidebar-foreground/80 truncate flex-1">{source.name}</span>
                        <span className="text-muted-foreground shrink-0">{source.kind}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditSource(source)
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => onAddSource(topic.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary font-sans hover:text-primary/80 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      添加数据源
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
