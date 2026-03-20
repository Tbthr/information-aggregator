"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2, Settings2, Clock, Key } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "engine" | "params" | "auth"
type Source = { id: string; name: string; url: string; type: "rss" | "json" }
type Topic = { id: string; name: string; sources: Source[]; keywords: string[]; blacklist: string[]; schedule: string; prompt: string }

const INITIAL_TOPICS: Topic[] = [
  {
    id: "t1",
    name: "AI 与大模型",
    sources: [
      { id: "s1", name: "The Verge · AI", url: "https://theverge.com/ai/rss", type: "rss" },
      { id: "s2", name: "Anthropic Blog", url: "https://anthropic.com/blog.rss", type: "rss" },
      { id: "s3", name: "OpenAI News", url: "https://openai.com/blog/rss", type: "rss" },
    ],
    keywords: ["LLM", "GPT", "Claude", "Gemini", "推理", "智能体"],
    blacklist: ["广告", "赞助", "评测笔记本"],
    schedule: "08:00",
    prompt: "请用中文对文章进行 3 要点摘要,聚焦技术突破和商业影响,语气简练专业。",
  },
  {
    id: "t2",
    name: "前端与工程",
    sources: [
      { id: "s4", name: "Vercel Blog", url: "https://vercel.com/blog/rss", type: "rss" },
      { id: "s5", name: "web.dev", url: "https://web.dev/feed.xml", type: "rss" },
    ],
    keywords: ["React", "Next.js", "TypeScript", "性能", "Web API"],
    blacklist: [],
    schedule: "09:00",
    prompt: "请总结文章的核心技术要点,列出开发者需要注意的变化。",
  },
]

export function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>("engine")
  const [topics, setTopics] = useState<Topic[]>(INITIAL_TOPICS)
  const [selectedTopic, setSelectedTopic] = useState<Topic>(INITIAL_TOPICS[0])
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set(["t1"]))
  const [editingTopic, setEditingTopic] = useState<Topic>(INITIAL_TOPICS[0])

  const toggleExpand = (id: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectTopic = (topic: Topic) => {
    setSelectedTopic(topic)
    setEditingTopic({ ...topic })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab 切换 */}
      <div className="border-b border-border bg-sidebar px-6 py-3 flex gap-6">
        <button
          onClick={() => setActiveTab("engine")}
          className={cn(
            "text-sm font-sans font-medium transition-colors",
            activeTab === "engine" ? "text-primary border-b-2 border-primary pb-2" : "text-muted-foreground hover:text-foreground"
          )}
        >
          引擎配置
        </button>
        <button
          onClick={() => setActiveTab("params")}
          className={cn(
            "text-sm font-sans font-medium transition-colors",
            activeTab === "params" ? "text-primary border-b-2 border-primary pb-2" : "text-muted-foreground hover:text-foreground"
          )}
        >
          参数配置
        </button>
        <button
          onClick={() => setActiveTab("auth")}
          className={cn(
            "text-sm font-sans font-medium transition-colors",
            activeTab === "auth" ? "text-primary border-b-2 border-primary pb-2" : "text-muted-foreground hover:text-foreground"
          )}
        >
          认证配置
        </button>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "engine" && (
          <EngineConfig
            topics={topics}
            selectedTopic={selectedTopic}
            expandedTopics={expandedTopics}
            editingTopic={editingTopic}
            toggleExpand={toggleExpand}
            selectTopic={selectTopic}
          />
        )}
        {activeTab === "params" && <ParamsConfig />}
        {activeTab === "auth" && <AuthConfig />}
      </div>
    </div>
  )
}

interface EngineConfigProps {
  topics: Topic[]
  selectedTopic: Topic
  expandedTopics: Set<string>
  editingTopic: Topic
  toggleExpand: (id: string) => void
  selectTopic: (topic: Topic) => void
}

function EngineConfig({ topics, selectedTopic, expandedTopics, editingTopic, toggleExpand, selectTopic }: EngineConfigProps) {
  return (
    <div className="h-full flex">
      {/* 左侧主题树 */}
      <div className="w-72 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <p className="font-sans font-semibold text-sm text-sidebar-foreground">主题与数据源</p>
          <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" />
            新建主题
          </button>
        </div>

        <div className="py-2">
          {topics.map((topic) => (
            <div key={topic.id}>
              {/* 主题行 */}
              <button
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-sidebar-accent transition-colors",
                  selectedTopic.id === topic.id && "bg-sidebar-accent"
                )}
                onClick={() => { selectTopic(topic); toggleExpand(topic.id) }}
              >
                {expandedTopics.has(topic.id) ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className={cn(
                  "font-sans text-sm truncate",
                  selectedTopic.id === topic.id ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground/80"
                )}>
                  {topic.name}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{topic.sources.length}</span>
              </button>

              {/* 子源列表 */}
              {expandedTopics.has(topic.id) && (
                <div className="pl-7 py-1">
                  {topic.sources.map((source) => (
                    <div key={source.id} className="flex items-center gap-2 px-3 py-1.5 group">
                      <span
                        className="text-[9px] font-mono font-bold px-1 py-0.5 rounded uppercase"
                        style={{ background: "var(--bullet-bg)", color: "var(--accent-foreground)" }}
                      >
                        {source.type}
                      </span>
                      <span className="text-xs font-sans text-muted-foreground truncate flex-1">{source.name}</span>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                    </div>
                  ))}
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary font-sans hover:text-primary/80 transition-colors">
                    <Plus className="w-3 h-3" />
                    添加数据源
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 右侧规则配置 */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-6">
            <Settings2 className="w-4 h-4 text-primary" />
            <h2 className="font-sans font-semibold text-base text-foreground">
              处理规则 · <span className="text-primary">{editingTopic.name}</span>
            </h2>
          </div>

          <div className="space-y-6">
            {/* 关键词白名单 */}
            <div>
              <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                关键词白名单（匹配则提高评分）
              </label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-card min-h-[48px]">
                {editingTopic.keywords.map((kw, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs font-sans px-2.5 py-1 rounded-full"
                    style={{ background: "var(--bullet-bg)", color: "var(--accent-foreground)" }}>
                    {kw}
                    <button className="hover:text-destructive transition-colors text-muted-foreground">×</button>
                  </span>
                ))}
                <input
                  placeholder="输入后回车添加…"
                  className="text-xs font-sans bg-transparent outline-none placeholder:text-muted-foreground/50 min-w-[120px]"
                />
              </div>
            </div>

            {/* 关键词黑名单 */}
            <div>
              <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                关键词黑名单（匹配则过滤）
              </label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-card min-h-[48px]">
                {editingTopic.blacklist.map((kw, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs font-sans px-2.5 py-1 rounded-full bg-destructive/10 text-destructive">
                    {kw}
                    <button className="hover:opacity-70 transition-opacity">×</button>
                  </span>
                ))}
                <input
                  placeholder="输入后回车添加…"
                  className="text-xs font-sans bg-transparent outline-none placeholder:text-muted-foreground/50 min-w-[120px]"
                />
              </div>
            </div>

            {/* 定时任务 */}
            <div>
              <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                定时任务触发时间
              </label>
              <input
                type="time"
                defaultValue={editingTopic.schedule}
                className="text-sm font-mono bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
              <p className="mt-1.5 text-xs text-muted-foreground font-sans">后端每天此时拉取并处理该主题的所有数据源</p>
            </div>

            {/* AI Prompt */}
            <div>
              <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                AI 总结 Prompt 指令
              </label>
              <textarea
                rows={5}
                defaultValue={editingTopic.prompt}
                className="w-full text-sm font-sans bg-card border border-border rounded-lg px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow leading-relaxed"
              />
              <p className="mt-1.5 text-xs text-muted-foreground font-sans">
                此 Prompt 将在后端定时任务中传递给 AI,用于生成文章摘要与要点
              </p>
            </div>

            {/* 保存按钮 */}
            <div className="flex gap-3 pt-2">
              <button className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-sans font-medium hover:bg-primary/90 transition-colors">
                保存配置
              </button>
              <button className="px-5 py-2 rounded-lg border border-border text-sm font-sans text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                重置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ParamsConfig() {
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl">
        <h2 className="text-lg font-sans font-semibold mb-6">参数配置</h2>
        <p className="text-muted-foreground">参数配置功能开发中...</p>
      </div>
    </div>
  )
}

function AuthConfig() {
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl">
        <h2 className="text-lg font-sans font-semibold mb-6">认证配置</h2>
        <p className="text-muted-foreground">认证配置功能开发中...</p>
      </div>
    </div>
  )
}
