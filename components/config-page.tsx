"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2, Settings2, Clock, Key, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Tab = "engine" | "params" | "auth"
type Source = { id: string; name: string; url: string; type: "rss" | "json" }
type Pack = {
  id: string
  name: string
  description: string | null
  sourceCount: number
  itemCount: number
  latestItem: string | null
}

export function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>("engine")

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
        {activeTab === "engine" && <EngineConfig />}
        {activeTab === "params" && <ParamsConfig />}
        {activeTab === "auth" && <AuthConfig />}
      </div>
    </div>
  )
}

function EngineConfig() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null)
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set())

  // Load packs from database
  useEffect(() => {
    async function loadPacks() {
      try {
        const response = await fetch("/api/packs")
        const data = await response.json()
        if (data.success) {
          setPacks(data.data.packs)
          // Select first pack if available
          if (data.data.packs.length > 0) {
            setSelectedPack(data.data.packs[0])
          }
        }
      } catch (error) {
        console.error("Failed to load packs:", error)
      } finally {
        setLoading(false)
      }
    }

    loadPacks()
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectPack = (pack: Pack) => {
    setSelectedPack(pack)
  }

  const createPack = async () => {
    const name = prompt("输入 Pack 名称:")
    if (!name) return

    const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    if (!id) {
      alert("请输入有效的名称（至少包含一个字母或数字）")
      return
    }

    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Add new pack to the list
        const newPack: Pack = {
          id: data.data.id,
          name: data.data.name,
          description: data.data.description,
          sourceCount: 0,
          itemCount: 0,
          latestItem: null,
        }
        setPacks((prev) => [...prev, newPack])
        setSelectedPack(newPack)
        setExpandedPacks((prev) => new Set(prev).add(newPack.id))
      } else {
        alert(data.error || "创建 Pack 失败")
      }
    } catch (error) {
      console.error("Failed to create pack:", error)
      alert("创建 Pack 失败")
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-sans">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {/* 左侧 Pack 列表 */}
      <div className="w-72 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <p className="font-sans font-semibold text-sm text-sidebar-foreground">Pack 与数据源</p>
          <button
            onClick={createPack}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-sans font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            新建 Pack
          </button>
        </div>

        <div className="py-2">
          {packs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              暂无 Pack，点击上方按钮创建
            </div>
          ) : (
            packs.map((pack) => (
              <div key={pack.id}>
                {/* Pack 行 */}
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-sidebar-accent transition-colors",
                    selectedPack?.id === pack.id && "bg-sidebar-accent"
                  )}
                  onClick={() => { selectPack(pack); toggleExpand(pack.id) }}
                >
                  {expandedPacks.has(pack.id) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={cn(
                    "font-sans text-sm truncate",
                    selectedPack?.id === pack.id ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground/80"
                  )}>
                    {pack.name}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{pack.sourceCount}</span>
                </button>

                {/* 子源列表 - Placeholder for sources */}
                {expandedPacks.has(pack.id) && (
                  <div className="pl-7 py-1">
                    {/* TODO: Load sources from API */}
                    {pack.sourceCount === 0 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground">暂无数据源</div>
                    )}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary font-sans hover:text-primary/80 transition-colors">
                      <Plus className="w-3 h-3" />
                      添加数据源
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧详情配置 */}
      <div className="flex-1 overflow-y-auto p-8">
        {selectedPack ? (
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-6">
              <Settings2 className="w-4 h-4 text-primary" />
              <h2 className="font-sans font-semibold text-base text-foreground">
                Pack 详情 · <span className="text-primary">{selectedPack.name}</span>
              </h2>
            </div>

            <div className="space-y-6">
              {/* 基本信息 */}
              <div>
                <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  ID
                </label>
                <input
                  type="text"
                  value={selectedPack.id}
                  disabled
                  className="w-full text-sm font-mono bg-muted border border-border rounded-lg px-3 py-2 text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  名称
                </label>
                <input
                  type="text"
                  defaultValue={selectedPack.name}
                  className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  描述
                </label>
                <textarea
                  rows={3}
                  defaultValue={selectedPack.description || ""}
                  placeholder="可选的 Pack 描述..."
                  className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow"
                />
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-3 gap-4 p-4 rounded-lg border border-border bg-card">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-foreground">{selectedPack.sourceCount}</div>
                  <div className="text-xs text-muted-foreground">数据源</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-semibold text-foreground">{selectedPack.itemCount}</div>
                  <div className="text-xs text-muted-foreground">条目数</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-foreground">
                    {selectedPack.latestItem
                      ? new Date(selectedPack.latestItem).toLocaleDateString()
                      : "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">最新更新</div>
                </div>
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
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-sans">选择或创建一个 Pack 开始配置</p>
            </div>
          </div>
        )}
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
