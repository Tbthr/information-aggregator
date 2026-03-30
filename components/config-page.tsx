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
import { TopicListPanel } from "./config/topic-list-panel"
import { TopicDetailPanel } from "./config/topic-detail-panel"
import { AddSourceDialog } from "./config/add-source-dialog"
import type { Source, TopicConfig } from "./config/types"

export function ConfigPageHeader() {
  return (
    <div className="border-b border-border bg-sidebar px-6 py-3 flex gap-6">
      <span className="text-sm font-sans font-semibold text-primary">
        数据源配置
      </span>
    </div>
  )
}

export function ConfigPage() {
  return (
    <div className="h-full flex flex-col">
      <ConfigPageHeader />
      {/* 内容 */}
      <div className="flex-1 overflow-hidden">
        <EngineConfig />
      </div>
    </div>
  )
}

function EngineConfig() {
  const [topics, setTopics] = useState<TopicConfig[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTopic, setSelectedTopic] = useState<TopicConfig | null>(null)
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newTopicName, setNewTopicName] = useState("")
  const [addSourceTopicId, setAddSourceTopicId] = useState<string | null>(null)
  const [newSourceUrl, setNewSourceUrl] = useState("")
  const [newSourceKind, setNewSourceKind] = useState("rss")
  const [creatingSource, setCreatingSource] = useState(false)
  // 用于编辑 Topic 详情的本地状态
  const [editingTopicName, setEditingTopicName] = useState("")
  const [editingTopicDescription, setEditingTopicDescription] = useState("")
  const [savingTopic, setSavingTopic] = useState(false)
  const [editingSource, setEditingSource] = useState<Source | null>(null)

  // Load topics and sources from database
  const loadData = async () => {
    try {
      const [topicsRes, sourcesRes] = await Promise.all([
        fetch("/api/topics"),
        fetch("/api/sources"),
      ])
      const topicsData = await topicsRes.json()
      const sourcesData = await sourcesRes.json()

      if (topicsData.success) {
        setTopics(topicsData.data.topics)
        if (topicsData.data.topics.length > 0 && !selectedTopic) {
          setSelectedTopic(topicsData.data.topics[0])
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
    setExpandedTopics((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectTopic = (topic: TopicConfig) => {
    setSelectedTopic(topic)
    setEditingTopicName(topic.name)
    setEditingTopicDescription(topic.description || "")
  }

  const deleteTopic = async (topicId: string) => {
    try {
      const response = await fetch(`/api/topics/${topicId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setTopics((prev) => prev.filter((t) => t.id !== topicId))
        if (selectedTopic?.id === topicId) {
          setSelectedTopic(topics.length > 1 ? topics.find((t) => t.id !== topicId) || null : null)
        }
      } else {
        const data = await response.json()
        toast({ title: data.error || "删除 Topic 失败", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to delete topic:", error)
      toast({ title: "删除 Topic 失败", variant: "destructive" })
    }
  }

  const saveTopicConfig = async () => {
    if (!selectedTopic) return
    setSavingTopic(true)
    try {
      const response = await fetch(`/api/topics/${selectedTopic.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingTopicName,
          description: editingTopicDescription || null,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "保存失败")
      }
      // 更新本地状态
      const updatedTopic = { ...selectedTopic, name: editingTopicName, description: editingTopicDescription }
      setTopics((prev) =>
        prev.map((t) =>
          t.id === selectedTopic.id
            ? updatedTopic
            : t
        )
      )
      setSelectedTopic(updatedTopic)
    } catch (error) {
      console.error("保存失败:", error)
      toast({ title: error instanceof Error ? error.message : "保存失败", variant: "destructive" })
    } finally {
      setSavingTopic(false)
    }
  }

  const resetTopicConfig = () => {
    if (!selectedTopic) return
    setEditingTopicName(selectedTopic.name)
    setEditingTopicDescription(selectedTopic.description || "")
  }

  const createSource = async () => {
    if (!addSourceTopicId || !newSourceUrl.trim()) return

    setCreatingSource(true)
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: newSourceKind,
          name: newSourceUrl,
          url: newSourceUrl,
          defaultTopicIds: [addSourceTopicId],
          enabled: true,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setSources((prev) => [...prev, data.data])
        setAddSourceTopicId(null)
        setNewSourceUrl("")
        setNewSourceKind("rss")
        // Reload topics to update state
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

  const createTopic = async () => {
    if (!newTopicName.trim()) return

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTopicName }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const newTopic: TopicConfig = {
          id: data.data.id,
          name: data.data.name,
          description: data.data.description,
          includeRules: data.data.includeRules || [],
          excludeRules: data.data.excludeRules || [],
          scoreBoost: data.data.scoreBoost ?? 1.0,
          displayOrder: data.data.displayOrder ?? 0,
          maxItems: data.data.maxItems ?? 10,
        }
        setTopics((prev) => [...prev, newTopic])
        setSelectedTopic(newTopic)
        setExpandedTopics((prev) => new Set(prev).add(newTopic.id))
        setCreateDialogOpen(false)
        setNewTopicName("")
      } else {
        toast({ title: data.error || "创建 Topic 失败", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to create topic:", error)
      toast({ title: "创建 Topic 失败", variant: "destructive" })
    }
  }

  const startCreateTopic = () => {
    setNewTopicName("")
    setCreateDialogOpen(true)
  }

  // Count sources per topic using defaultTopicIds
  const getSourceCountForTopic = (topicId: string) => {
    return sources.filter((s) => s.defaultTopicIds?.includes(topicId)).length
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
      {/* 左侧 Topic 列表 */}
      <TopicListPanel
        topics={topics}
        sources={sources}
        selectedTopic={selectedTopic}
        expandedTopics={expandedTopics}
        onSelectTopic={selectTopic}
        onToggleExpand={toggleExpand}
        onCreateTopic={startCreateTopic}
        onAddSource={setAddSourceTopicId}
        onEditSource={setEditingSource}
      />

      {/* 右侧详情配置 */}
      <TopicDetailPanel
        selectedTopic={selectedTopic}
        editingTopicName={editingTopicName}
        editingTopicDescription={editingTopicDescription}
        savingTopic={savingTopic}
        sourceCount={selectedTopic ? getSourceCountForTopic(selectedTopic.id) : 0}
        onEditingTopicNameChange={setEditingTopicName}
        onEditingTopicDescriptionChange={setEditingTopicDescription}
        onSave={saveTopicConfig}
        onReset={resetTopicConfig}
        onDeleteTopic={deleteTopic}
      />

      {/* 创建 Topic 对话框 */}
      <AlertDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>新建 Topic</AlertDialogTitle>
            <AlertDialogDescription>
              输入 Topic 名称，系统将自动生成 ID。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            placeholder="例如：技术博客、新闻资讯"
            className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow mt-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                createTopic()
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={createTopic}>创建</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加数据源对话框 */}
      <AddSourceDialog
        open={!!addSourceTopicId}
        onOpenChange={(open) => { if (!open) setAddSourceTopicId(null) }}
        topicName={topics.find(t => t.id === addSourceTopicId)?.name ?? ""}
        newSourceKind={newSourceKind}
        newSourceUrl={newSourceUrl}
        creatingSource={creatingSource}
        onSourceKindChange={setNewSourceKind}
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
