"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2, Settings2, Loader2, Check, Key, Pencil, Rss, Globe, Flame, MessageSquare, Bookmark, Heart, Github, FileJson, List } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { SourceEditDialog } from "./source-edit-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Source = { id: string; name: string; url: string | null; type: string; enabled: boolean; packId: string | null; description?: string | null }
type Pack = {
  id: string
  name: string
  description: string | null
  sourceCount: number
  itemCount: number
  latestItem: string | null
}

const SOURCE_TYPE_CATEGORIES: Array<{ label: string; types: Array<{ value: string; label: string; icon: LucideIcon | string }> }> = [
  {
    label: "RSS & Feeds",
    types: [
      { value: "rss", label: "RSS Feed", icon: Rss },
      { value: "json-feed", label: "JSON Feed", icon: FileJson },
    ],
  },
  {
    label: "Web",
    types: [
      { value: "website", label: "Website", icon: Globe },
      { value: "hn", label: "Hacker News", icon: Flame },
      { value: "reddit", label: "Reddit", icon: MessageSquare },
    ],
  },
  {
    label: "Social",
    types: [
      { value: "x-home", label: "X Home", icon: "X" },
      { value: "x-list", label: "X List", icon: List },
      { value: "x-bookmarks", label: "X Bookmarks", icon: Bookmark },
      { value: "x-likes", label: "X Likes", icon: Heart },
    ],
  },
  {
    label: "Dev",
    types: [
      { value: "github-trending", label: "GitHub Trending", icon: Github },
    ],
  },
]

export function ConfigPage() {
  return (
    <div className="h-full flex flex-col">
      {/* Tab 标题 */}
      <div className="border-b border-border bg-sidebar px-6 py-3 flex gap-6">
        <span className="text-sm font-sans font-semibold text-primary">
          数据源配置
        </span>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-hidden">
        <EngineConfig />
      </div>
    </div>
  )
}

function EngineConfig() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null)
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newPackName, setNewPackName] = useState("")
  const [addSourcePackId, setAddSourcePackId] = useState<string | null>(null)
  const [newSourceUrl, setNewSourceUrl] = useState("")
  const [newSourceType, setNewSourceType] = useState("rss")
  const [creatingSource, setCreatingSource] = useState(false)
  // 用于编辑 Pack 详情的本地状态
  const [editingPackName, setEditingPackName] = useState("")
  const [editingPackDescription, setEditingPackDescription] = useState("")
  const [savingPack, setSavingPack] = useState(false)
  const [authStatusMap, setAuthStatusMap] = useState<Record<string, boolean>>({})
  const [editingSource, setEditingSource] = useState<Source | null>(null)

  // Load packs and sources from database
  const loadData = async () => {
    try {
      const [packsRes, sourcesRes] = await Promise.all([
        fetch("/api/packs"),
        fetch("/api/sources"),
      ])
      const packsData = await packsRes.json()
      const sourcesData = await sourcesRes.json()

      if (packsData.success) {
        setPacks(packsData.data.packs)
        if (packsData.data.packs.length > 0 && !selectedPack) {
          setSelectedPack(packsData.data.packs[0])
        }
      }
      if (sourcesData.success) {
        setSources(sourcesData.data.sources)
        // 批量加载 auth 状态
        const sourceIds = sourcesData.data.sources.map((s: Source) => s.id).filter(Boolean)
        if (sourceIds.length > 0) {
          try {
            const authRes = await fetch(`/api/auth-config/batch?sourceIds=${sourceIds.join(",")}`)
            const authData = await authRes.json()
            if (authData.success) {
              const map: Record<string, boolean> = {}
              for (const [id, info] of Object.entries(authData.data)) {
                map[id] = (info as { hasConfig: boolean }).hasConfig
              }
              setAuthStatusMap(map)
            }
          } catch {
            // ignore auth status fetch failure
          }
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
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
    setEditingPackName(pack.name)
    setEditingPackDescription(pack.description || "")
  }

  const deletePack = async (packId: string) => {
    try {
      const response = await fetch(`/api/packs/${packId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setPacks((prev) => prev.filter((p) => p.id !== packId))
        setSources((prev) => prev.filter((s) => s.packId !== packId))
        if (selectedPack?.id === packId) {
          setSelectedPack(packs.length > 1 ? packs.find((p) => p.id !== packId) || null : null)
        }
      } else {
        const data = await response.json()
        alert(data.error || "删除 Pack 失败")
      }
    } catch (error) {
      console.error("Failed to delete pack:", error)
      alert("删除 Pack 失败")
    }
  }

  const savePackConfig = async () => {
    if (!selectedPack) return
    setSavingPack(true)
    try {
      const response = await fetch(`/api/packs/${selectedPack.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingPackName,
          description: editingPackDescription || null,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "保存失败")
      }
      // 更新本地状态
      setPacks((prev) =>
        prev.map((p) =>
          p.id === selectedPack.id
            ? { ...p, name: editingPackName, description: editingPackDescription }
            : p
        )
      )
      setSelectedPack({ ...selectedPack, name: editingPackName, description: editingPackDescription })
    } catch (error) {
      console.error("保存失败:", error)
      alert(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSavingPack(false)
    }
  }

  const resetPackConfig = () => {
    if (!selectedPack) return
    setEditingPackName(selectedPack.name)
    setEditingPackDescription(selectedPack.description || "")
  }

  const createSource = async () => {
    if (!addSourcePackId || !newSourceUrl.trim()) return

    setCreatingSource(true)
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newSourceType,
          name: newSourceUrl,
          url: newSourceUrl,
          packId: addSourcePackId,
          enabled: true,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setSources((prev) => [...prev, data.data])
        setAddSourcePackId(null)
        setNewSourceUrl("")
        setNewSourceType("rss")
        // Reload packs to update source count
        loadData()
      } else {
        alert(data.error || "创建数据源失败")
      }
    } catch (error) {
      console.error("Failed to create source:", error)
      alert("创建数据源失败")
    } finally {
      setCreatingSource(false)
    }
  }

  const createPack = async () => {
    if (!newPackName.trim()) return

    const id = newPackName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")

    if (!id) {
      alert("请输入有效的名称（至少包含一个字母或数字）")
      return
    }

    try {
      const response = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newPackName }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
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
        setCreateDialogOpen(false)
        setNewPackName("")
      } else {
        alert(data.error || "创建 Pack 失败")
      }
    } catch (error) {
      console.error("Failed to create pack:", error)
      alert("创建 Pack 失败")
    }
  }

  const startCreatePack = () => {
    setNewPackName("")
    setCreateDialogOpen(true)
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
            onClick={startCreatePack}
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

                {/* 子源列表 */}
                {expandedPacks.has(pack.id) && (
                  <div className="pl-7 py-1">
                    {Array.from(new Map(sources.filter(s => s.packId === pack.id).map(s => [s.id, s])).values()).length === 0 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground">暂无数据源</div>
                    )}
                    {Array.from(new Map(sources.filter(s => s.packId === pack.id).map(s => [s.id, s])).values()).map((source) => (
                      <div
                        key={source.id}
                        className="relative group flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-sidebar-accent/60 rounded-sm transition-colors"
                        onClick={() => setEditingSource(source)}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            source.enabled ? "bg-green-500" : "bg-gray-400"
                          )}
                        />
                        <span className="text-sidebar-foreground/80 truncate flex-1">{source.name}</span>
                        {authStatusMap[source.id] && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Key className="w-3 h-3 text-green-500 shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              X/Twitter 认证已配置
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <span className="text-muted-foreground shrink-0">{source.type}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSource(source)
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setAddSourcePackId(pack.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary font-sans hover:text-primary/80 transition-colors"
                    >
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
                  value={editingPackName}
                  onChange={(e) => setEditingPackName(e.target.value)}
                  className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  描述
                </label>
                <textarea
                  rows={3}
                  value={editingPackDescription}
                  onChange={(e) => setEditingPackDescription(e.target.value)}
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

              {/* 保存/删除按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={savePackConfig}
                  disabled={savingPack}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-sans font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  保存配置
                </button>
                <button
                  onClick={resetPackConfig}
                  className="px-5 py-2 rounded-lg border border-border text-sm font-sans text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  重置
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="ml-auto px-4 py-2 rounded-lg border border-destructive/30 text-sm font-sans text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>删除 Pack</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除 "{selectedPack.name}" 吗？此操作将同时删除该 Pack 下的所有数据源，且无法撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deletePack(selectedPack.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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

      {/* 创建 Pack 对话框 */}
      <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>新建 Pack</AlertDialogTitle>
            <AlertDialogDescription>
              输入 Pack 名称，系统将自动生成 ID。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={newPackName}
            onChange={(e) => setNewPackName(e.target.value)}
            placeholder="例如：技术博客、新闻资讯"
            className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow mt-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                createPack()
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={createPack}>创建</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加数据源对话框 */}
      <AlertDialog open={!!addSourcePackId} onOpenChange={() => setAddSourcePackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>添加数据源</AlertDialogTitle>
            <AlertDialogDescription>
              为 {packs.find(p => p.id === addSourcePackId)?.name} 添加新的数据源。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-2">
                数据源类型
              </label>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {SOURCE_TYPE_CATEGORIES.map((category) => (
                  <div key={category.label}>
                    <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      {category.label}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {category.types.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setNewSourceType(type.value)}
                          className={cn(
                            "relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200",
                            newSourceType === type.value
                              ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                              : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card hover:shadow-sm"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                            newSourceType === type.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {typeof type.icon === "string"
                              ? <span className="text-[10px] font-bold">{type.icon}</span>
                              : <type.icon className="w-3.5 h-3.5" />}
                          </div>
                          <p className={cn(
                            "text-[10px] font-medium text-center leading-tight",
                            newSourceType === type.value ? "text-primary" : "text-foreground"
                          )}>
                            {type.label}
                          </p>
                          {newSourceType === type.value && (
                            <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-2 h-2 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-1">
                URL / 链接
              </label>
              <input
                type="text"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    createSource()
                  }
                }}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAddSourcePackId(null); setNewSourceUrl("") }}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={createSource} disabled={creatingSource || !newSourceUrl.trim()}>
              {creatingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              添加
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑数据源对话框 */}
      <SourceEditDialog
        source={editingSource}
        open={!!editingSource}
        onOpenChange={(open) => { if (!open) setEditingSource(null) }}
        onSave={(updatedSource, authHasConfig) => {
          setSources(prev => prev.map(s => s.id === updatedSource.id ? updatedSource : s))
          if (authHasConfig !== undefined) {
            setAuthStatusMap(prev => ({ ...prev, [updatedSource.id]: authHasConfig }))
          }
          setEditingSource(null)
        }}
      />
    </div>
  )
}
