"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { SourceEditDialog } from "./source-edit-dialog"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PackListPanel } from "./config/pack-list-panel"
import { PackDetailPanel } from "./config/pack-detail-panel"
import { AddSourceDialog } from "./config/add-source-dialog"
import type { Source, Pack } from "./config/types"

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
        toast({ title: data.error || "删除 Pack 失败", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to delete pack:", error)
      toast({ title: "删除 Pack 失败", variant: "destructive" })
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
      toast({ title: error instanceof Error ? error.message : "保存失败", variant: "destructive" })
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
        toast({ title: data.error || "创建数据源失败", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to create source:", error)
      toast({ title: "创建数据源失败", variant: "destructive" })
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
      toast({ title: "请输入有效的名称（至少包含一个字母或数字）", variant: "destructive" })
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
        toast({ title: data.error || "创建 Pack 失败", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to create pack:", error)
      toast({ title: "创建 Pack 失败", variant: "destructive" })
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
      <PackListPanel
        packs={packs}
        sources={sources}
        selectedPack={selectedPack}
        expandedPacks={expandedPacks}
        onSelectPack={selectPack}
        onToggleExpand={toggleExpand}
        onCreatePack={startCreatePack}
        onAddSource={setAddSourcePackId}
        onEditSource={setEditingSource}
      />

      {/* 右侧详情配置 */}
      <PackDetailPanel
        selectedPack={selectedPack}
        editingPackName={editingPackName}
        editingPackDescription={editingPackDescription}
        savingPack={savingPack}
        onEditingPackNameChange={setEditingPackName}
        onEditingPackDescriptionChange={setEditingPackDescription}
        onSave={savePackConfig}
        onReset={resetPackConfig}
        onDeletePack={deletePack}
      />

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
      <AddSourceDialog
        open={!!addSourcePackId}
        onOpenChange={(open) => { if (!open) setAddSourcePackId(null) }}
        packName={packs.find(p => p.id === addSourcePackId)?.name ?? ""}
        newSourceType={newSourceType}
        newSourceUrl={newSourceUrl}
        creatingSource={creatingSource}
        onSourceTypeChange={setNewSourceType}
        onSourceUrlChange={setNewSourceUrl}
        onCreate={createSource}
      />

      {/* 编辑数据源对话框 */}
      <SourceEditDialog
        source={editingSource}
        open={!!editingSource}
        onOpenChange={(open) => { if (!open) setEditingSource(null) }}
        onSave={(updatedSource) => {
          setSources(prev => prev.map(s => s.id === updatedSource.id ? updatedSource : s))
          setEditingSource(null)
        }}
      />
    </div>
  )
}
