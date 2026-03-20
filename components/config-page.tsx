"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2, Settings2, Clock, Eye, EyeOff, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthConfigSection } from "./auth-config-section"
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

type Tab = "datasource" | "ai"
type Source = { id: string; name: string; url: string | null; type: string; enabled: boolean; packId: string | null }
type Pack = {
  id: string
  name: string
  description: string | null
  sourceCount: number
  itemCount: number
  latestItem: string | null
}
type ProviderConfigItem = {
  id: string
  provider: string
  model: string
  baseUrl: string | null
  hasApiKey: boolean
}

type ProviderConfigForm = {
  apiKey: string
  model: string
  baseUrl: string
}

type Settings = {
  id: string
  provider: string | null
  batchSize: number | null
  concurrency: number | null
  maxRetries: number | null
  initialDelay: number | null
  maxDelay: number | null
  backoffFactor: number | null
}

export function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>("datasource")

  return (
    <div className="h-full flex flex-col">
      {/* Tab 切换 */}
      <div className="border-b border-border bg-sidebar px-6 py-3 flex gap-6">
        <button
          onClick={() => setActiveTab("datasource")}
          className={cn(
            "text-sm font-sans font-medium transition-colors",
            activeTab === "datasource" ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
          )}
        >
          数据源配置
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={cn(
            "text-sm font-sans font-medium transition-colors",
            activeTab === "ai" ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
          )}
        >
          AI 配置
        </button>
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "datasource" && <EngineConfig />}
        {activeTab === "ai" && <AiConfig />}
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
                        className="flex items-center gap-2 px-3 py-1.5 text-xs"
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            source.enabled ? "bg-green-500" : "bg-gray-400"
                          )}
                        />
                        <span className="text-sidebar-foreground/80 truncate">{source.name}</span>
                        <span className="text-muted-foreground shrink-0">{source.type}</span>
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

              {/* 认证配置 */}
              <AuthConfigSection packId={selectedPack.id} />

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
              <label className="block text-xs font-sans text-muted-foreground mb-1">
                数据源类型
              </label>
              <select
                value={newSourceType}
                onChange={(e) => setNewSourceType(e.target.value)}
                className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="rss">RSS Feed</option>
                <option value="twitter">Twitter/X</option>
                <option value="github">GitHub</option>
                <option value="substack">Substack</option>
              </select>
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
    </div>
  )
}

function AiConfig() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigItem[]>([])
  const [currentProviderConfig, setCurrentProviderConfig] = useState<ProviderConfigForm>({
    apiKey: "",
    model: "",
    baseUrl: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // 加载设置和 provider 配置
  useEffect(() => {
    async function loadSettings() {
      try {
        const [settingsRes, configsRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/provider-configs"),
        ])
        const settingsData = await settingsRes.json()
        const configsData = await configsRes.json()

        if (settingsData.success) {
          setSettings(settingsData.data)
        }

        if (configsData.success) {
          setProviderConfigs(configsData.data)
          // 设置当前 provider 的配置
          const currentProvider = settingsData.data?.provider || "anthropic"
          const config = configsData.data.find((c: ProviderConfigItem) => c.provider === currentProvider)
          const defaults = getProviderDefaults(currentProvider)
          if (config) {
            setCurrentProviderConfig({
              apiKey: "",
              model: config.model || defaults.model,
              baseUrl: config.baseUrl || defaults.baseUrl,
            })
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  // 更新 provider 配置表单
  const updateProviderConfigForm = (key: keyof ProviderConfigForm, value: string) => {
    setCurrentProviderConfig((prev) => ({ ...prev, [key]: value }))
  }

  // 更新 settings 字段
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      if (!prev) return prev
      const newSettings = { ...prev, [key]: value }

      // 如果切换了 provider，需要重新加载配置
      if (key === "provider") {
        const config = providerConfigs.find((c) => c.provider === value)
        const defaults = getProviderDefaults(value as string)
        if (config) {
          setCurrentProviderConfig({
            apiKey: "",
            model: config.model || defaults.model,
            baseUrl: config.baseUrl || defaults.baseUrl,
          })
        }
      }

      return newSettings
    })
  }

  // Provider 默认配置
  const getProviderDefaults = (provider: string | null) => {
    switch (provider) {
      case "anthropic":
        return { model: "claude-3-5-sonnet-20241022", baseUrl: "https://api.anthropic.com" }
      case "openai":
        return { model: "gpt-4o", baseUrl: "https://api.openai.com/v1" }
      case "gemini":
        return { model: "gemini-2.0-flash", baseUrl: "https://generativelanguage.googleapis.com" }
      default:
        return { model: "", baseUrl: "" }
    }
  }

  const handleSave = async () => {
    if (!settings) return

    // 清除之前的错误
    setValidationErrors({})

    // 校验必填字段
    const errors: Record<string, string> = {}
    const currentConfig = providerConfigs.find((c) => c.provider === settings.provider)
    const hasExistingApiKey = currentConfig?.hasApiKey

    if (!currentProviderConfig.apiKey && !hasExistingApiKey) {
      errors.apiKey = "API Key 是必填项"
    }
    if (!currentProviderConfig.model) {
      errors.model = "模型是必填项"
    }
    if (!currentProviderConfig.baseUrl) {
      errors.baseUrl = "Base URL 是必填项"
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setSaving(true)

    try {
      // 1. 保存 Settings
      const settingsResponse = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          batchSize: settings.batchSize,
          concurrency: settings.concurrency,
          maxRetries: settings.maxRetries,
          initialDelay: settings.initialDelay,
          maxDelay: settings.maxDelay,
          backoffFactor: settings.backoffFactor,
        }),
      })

      // 2. 保存当前 ProviderConfig
      const configResponse = await fetch("/api/provider-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider || "anthropic",
          model: currentProviderConfig.model,
          baseUrl: currentProviderConfig.baseUrl,
          // 如果有新的 API Key 输入则发送，否则不发送（保留原有）
          ...(currentProviderConfig.apiKey && {
            apiKey: currentProviderConfig.apiKey,
          }),
        }),
      })

      if (settingsResponse.ok && configResponse.ok) {
        // 重新加载配置以更新 hasApiKey 状态
        const configsRes = await fetch("/api/provider-configs")
        const configsData = await configsRes.json()
        if (configsData.success) {
          setProviderConfigs(configsData.data)
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error("Failed to save settings:", error)
    } finally {
      setSaving(false)
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
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl">
        <h2 className="text-lg font-sans font-semibold mb-6">AI 配置</h2>

        <div className="space-y-6">
          {/* Provider 选择 */}
          <div>
            <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              默认 Provider
            </label>
            <p className="text-xs text-muted-foreground mb-2">选择默认使用的 AI 服务提供商</p>
            <select
              value={settings?.provider || ""}
              onChange={(e) => updateSetting("provider", e.target.value)}
              className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
            >
              <option value="">选择 Provider</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          {/* API 配置 - 拆分为 3 个独立字段 */}
          {settings?.provider && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-sans font-semibold">API 配置 <span className="text-red-500">*</span></h3>

              {/* API Key */}
              <div>
                <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  API Key <span className="text-red-500">*</span>
                  {providerConfigs.find((c) => c.provider === settings.provider)?.hasApiKey && (
                    <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">• 已配置</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    placeholder={!currentProviderConfig.apiKey && providerConfigs.find((c) => c.provider === settings.provider)?.hasApiKey ? "••••••••••••••••" : "输入 API Key"}
                    value={currentProviderConfig.apiKey}
                    onChange={(e) => updateProviderConfigForm("apiKey", e.target.value)}
                    className={`w-full text-sm font-sans bg-background border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow font-mono ${
                      validationErrors.apiKey ? "border-red-500" : "border-border"
                    } ${currentProviderConfig.apiKey ? "pr-10" : ""}`}
                  />
                  {currentProviderConfig.apiKey && (
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {validationErrors.apiKey && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.apiKey}</p>
                )}
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  模型 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={getProviderDefaults(settings.provider).model}
                  value={currentProviderConfig.model}
                  onChange={(e) => updateProviderConfigForm("model", e.target.value)}
                  className={`w-full text-sm font-sans bg-background border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow ${
                    validationErrors.model ? "border-red-500" : "border-border"
                  }`}
                />
                {validationErrors.model && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.model}</p>
                )}
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={getProviderDefaults(settings.provider).baseUrl}
                  value={currentProviderConfig.baseUrl}
                  onChange={(e) => updateProviderConfigForm("baseUrl", e.target.value)}
                  className={`w-full text-sm font-sans bg-background border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow ${
                    validationErrors.baseUrl ? "border-red-500" : "border-border"
                  }`}
                />
                {validationErrors.baseUrl && (
                  <p className="text-xs text-red-500 mt-1">{validationErrors.baseUrl}</p>
                )}
              </div>
            </div>
          )}

          {/* 批次配置 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                批次大小
              </label>
              <p className="text-xs text-muted-foreground mb-2">每次请求处理的最大条目数</p>
              <input
                type="number"
                value={settings?.batchSize || 3}
                onChange={(e) => updateSetting("batchSize", parseInt(e.target.value) || 3)}
                className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                并发数
              </label>
              <p className="text-xs text-muted-foreground mb-2">同时进行的请求数量</p>
              <input
                type="number"
                value={settings?.concurrency || 1}
                onChange={(e) => updateSetting("concurrency", parseInt(e.target.value) || 1)}
                className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>
          </div>

          {/* 重试策略 */}
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="text-sm font-sans font-semibold mb-4">重试策略</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  最大重试次数
                </label>
                <p className="text-xs text-muted-foreground mb-1">请求失败后的最大重试次数</p>
                <input
                  type="number"
                  value={settings?.maxRetries || 3}
                  onChange={(e) => updateSetting("maxRetries", parseInt(e.target.value) || 3)}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  初始延迟 (ms)
                </label>
                <p className="text-xs text-muted-foreground mb-1">首次重试前的等待时间</p>
                <input
                  type="number"
                  value={settings?.initialDelay || 1000}
                  onChange={(e) => updateSetting("initialDelay", parseInt(e.target.value) || 1000)}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  最大延迟 (ms)
                </label>
                <p className="text-xs text-muted-foreground mb-1">重试间隔的最大等待时间</p>
                <input
                  type="number"
                  value={settings?.maxDelay || 30000}
                  onChange={(e) => updateSetting("maxDelay", parseInt(e.target.value) || 30000)}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  退避系数
                </label>
                <p className="text-xs text-muted-foreground mb-1">每次重试延迟的增长倍数</p>
                <input
                  type="number"
                  step="0.1"
                  value={settings?.backoffFactor || 2}
                  onChange={(e) => updateSetting("backoffFactor", parseFloat(e.target.value) || 2)}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-sans font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              保存配置
            </button>
            {saved && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" />
                已保存
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
