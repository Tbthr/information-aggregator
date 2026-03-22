"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { usePacks, useCustomViews } from "@/hooks/use-api"
import { toast } from "@/hooks/use-toast"
import {
  Sun,
  BookOpen,
  Plus,
  Bookmark,
  Settings,
  Rss,
  PanelLeftClose,
  PanelLeft,
  AtSign,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

// Re-export types for external consumers
export type { NavId } from "./sidebar/types"
export type { SidebarProps } from "./sidebar/types"

// Internal imports
import type { NavId, CustomView, SidebarProps, ViewFilter } from "./sidebar/types"
import { NavButton } from "./sidebar/nav-button"
import { SortableViewItem } from "./sidebar/sortable-view-item"
import { ViewEditDrawer } from "./sidebar/view-edit-drawer"

const EDITIONS = [
  { id: "daily" as NavId, label: "每日晨报", sublabel: "The Daily", icon: Sun },
  { id: "weekly" as NavId, label: "周末特刊", sublabel: "The Weekly", icon: BookOpen },
]

const SOCIAL_NAV = [
  { id: "x" as NavId, label: "X / Twitter", sublabel: "Social", icon: AtSign },
]

export function Sidebar({ activeNav, onNav, savedCount, collapsed, onToggleCollapse }: SidebarProps) {
  // SWR hooks
  const { data: customViews = [], isLoading: viewsLoading, mutate: mutateCustomViews } = useCustomViews()
  const { data: packs = [] } = usePacks()

  // Drawer 状态
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [viewName, setViewName] = useState("")
  const [viewIcon, setViewIcon] = useState("zap")
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set())
  const [timeWindow, setTimeWindow] = useState<ViewFilter["timeWindow"]>("week")
  const [sortBy, setSortBy] = useState<ViewFilter["sortBy"]>("ranked")
  const [saving, setSaving] = useState(false)
  const [editingView, setEditingView] = useState<CustomView | null>(null)

  // 删除确认状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 本地排序状态（乐观更新）
  const [localViews, setLocalViews] = useState<CustomView[]>([])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 同步本地视图状态
  const viewsToRender = localViews.length > 0 ? localViews : customViews

  // 打开创建 Drawer
  const openCreateDrawer = () => {
    setIsEditMode(false)
    setEditingView(null)
    setViewName("")
    setViewIcon("zap")
    setSelectedPackIds(new Set())
    setTimeWindow("week")
    setSortBy("ranked")
    setDrawerOpen(true)
  }

  // 打开编辑 Drawer
  const openEditDrawer = async (view: CustomView) => {
    try {
      const response = await fetch(`/api/custom-views/${view.id}`)
      const data = await response.json()
      if (data.success && data.data) {
        const viewData = data.data
        setIsEditMode(true)
        setEditingView(viewData)
        setViewName(viewData.name)
        setViewIcon(viewData.icon || "zap")
        const packIds = viewData.customViewPacks?.map((p: { packId: string }) => p.packId) || []
        setSelectedPackIds(new Set(packIds))
        if (viewData.filterJson) {
          try {
            const filter = JSON.parse(viewData.filterJson) as ViewFilter
            setTimeWindow(filter.timeWindow || "week")
            setSortBy(filter.sortBy || "ranked")
          } catch {
            setTimeWindow("week")
            setSortBy("ranked")
          }
        } else {
          setTimeWindow("week")
          setSortBy("ranked")
        }
        setDrawerOpen(true)
      }
    } catch (error) {
      console.error("Failed to load view details:", error)
    }
  }

  // 保存视图（创建或更新）
  const saveView = async () => {
    if (!viewName.trim()) return

    setSaving(true)
    try {
      const filterJson: ViewFilter = {
        timeWindow,
        sortBy,
      }

      if (isEditMode && editingView) {
        // 更新
        const response = await fetch(`/api/custom-views/${editingView.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: viewName,
            icon: viewIcon,
            packIds: Array.from(selectedPackIds),
            filterJson: JSON.stringify(filterJson),
          }),
        })
        const data = await response.json()
        if (response.ok && data.success) {
          mutateCustomViews()
          setDrawerOpen(false)
        } else {
          toast({ title: data.error || "更新视图失败", variant: "destructive" })
        }
      } else {
        // 创建
        const response = await fetch("/api/custom-views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: viewName,
            icon: viewIcon,
            description: "",
            packIds: Array.from(selectedPackIds),
            filterJson: JSON.stringify(filterJson),
          }),
        })
        const data = await response.json()
        if (response.ok && data.success) {
          mutateCustomViews()
          setDrawerOpen(false)
        } else {
          toast({ title: data.error || "创建视图失败", variant: "destructive" })
        }
      }
    } catch (error) {
      console.error("Failed to save view:", error)
      toast({ title: "保存视图失败", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // 删除视图
  const deleteView = async () => {
    if (!editingView) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/custom-views/${editingView.id}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (response.ok && data.success) {
        mutateCustomViews()
        setDeleteConfirmOpen(false)
        setDrawerOpen(false)
      } else {
        toast({ title: data.error || "删除视图失败", variant: "destructive" })
      }
    } catch (error) {
      console.error("Failed to delete view:", error)
      toast({ title: "删除视图失败", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  // 拖拽结束处理
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = viewsToRender.findIndex((v) => v.id === active.id)
      const newIndex = viewsToRender.findIndex((v) => v.id === over.id)

      const newViews = arrayMove(viewsToRender, oldIndex, newIndex).map((v, i) => ({
        ...v,
        order: i,
      }))

      // 乐观更新
      setLocalViews(newViews)

      // 发送到服务器
      try {
        await fetch("/api/custom-views/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: newViews.map((v) => ({ id: v.id, order: v.order! })),
          }),
        })
        mutateCustomViews()
      } catch (error) {
        console.error("Failed to reorder views:", error)
        setLocalViews([]) // 回滚
      }
    }
  }

  // Drawer 关闭时重置本地状态
  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open)
    if (!open) {
      setLocalViews([])
    }
  }

  // Pack toggle handler for ViewEditDrawer
  const handlePackToggle = (packId: string, checked: boolean) => {
    const newSet = new Set(selectedPackIds)
    if (checked) {
      newSet.add(packId)
    } else {
      newSet.delete(packId)
    }
    setSelectedPackIds(newSet)
  }

  return (
    <nav
      className={cn(
        "h-full flex flex-col border-r border-sidebar-border/30 bg-sidebar/95 backdrop-blur-md transition-all duration-300 ease-in-out overflow-hidden shrink-0 animate-slide-in-left",
        collapsed ? "w-14" : "w-56"
      )}
      aria-label="主导航"
    >
      {/* Logo & Toggle */}
      <div className={cn(
        "flex items-center border-b border-sidebar-border h-14",
        collapsed ? "justify-center px-0" : "px-4 justify-between"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Rss className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-base text-sidebar-foreground tracking-tight">Lens</span>
          </div>
        )}
        {collapsed && (
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Rss className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-sidebar-accent transition-colors"
            aria-label="收起侧边栏"
          >
            <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* 展开按钮（折叠时） */}
      {collapsed && (
        <button
          onClick={onToggleCollapse}
          className="mt-2 mx-auto p-1.5 rounded hover:bg-sidebar-accent transition-colors"
          aria-label="展开侧边栏"
        >
          <PanelLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      <div className="flex-1 overflow-y-auto py-3 space-y-5">
        {/* 简报 */}
        <section>
          {!collapsed && (
            <p className="px-4 mb-1 text-[10px] font-sans font-semibold tracking-widest uppercase text-muted-foreground">
              简报
            </p>
          )}
          {EDITIONS.map(({ id, label, sublabel, icon: Icon }) => (
            <NavButton
              key={id}
              active={activeNav === id}
              collapsed={collapsed}
              onClick={() => onNav(id)}
              icon={<Icon className="w-4 h-4 shrink-0" />}
              label={label}
              sublabel={sublabel}
            />
          ))}
        </section>

        {/* 社交 */}
        <section>
          {!collapsed && (
            <p className="px-4 mb-1 text-[10px] font-sans font-semibold tracking-widest uppercase text-muted-foreground">
              社交
            </p>
          )}
          {SOCIAL_NAV.map(({ id, label, sublabel, icon: Icon }) => (
            <NavButton
              key={id}
              active={activeNav === id}
              collapsed={collapsed}
              onClick={() => onNav(id)}
              icon={<Icon className="w-4 h-4 shrink-0" />}
              label={label}
              sublabel={sublabel}
            />
          ))}
        </section>

        {/* 我的视图 */}
        <section>
          {!collapsed && (
            <div className="px-4 mb-1 flex items-center justify-between">
              <p className="text-[10px] font-sans font-semibold tracking-widest uppercase text-muted-foreground">
                我的视图
              </p>
              <button
                onClick={openCreateDrawer}
                className="hover:text-foreground text-muted-foreground transition-colors"
                title="创建新视图"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {viewsLoading ? (
            !collapsed && (
              <p className="px-4 py-2 text-xs text-muted-foreground">Loading...</p>
            )
          ) : viewsToRender.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={viewsToRender.map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                {viewsToRender.map((view) => (
                  <SortableViewItem
                    key={view.id}
                    view={view}
                    active={activeNav === view.id}
                    collapsed={collapsed}
                    onNav={onNav}
                    onEdit={openEditDrawer}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : null}
        </section>
      </div>

      {/* 底部工具区 */}
      <div className="border-t border-sidebar-border py-3">
        <NavButton
          active={activeNav === "saved"}
          collapsed={collapsed}
          onClick={() => onNav("saved")}
          icon={<Bookmark className="w-4 h-4 shrink-0" />}
          label="我的收藏夹"
          badge={savedCount > 0 ? savedCount : undefined}
        />
        <NavButton
          active={activeNav === "config"}
          collapsed={collapsed}
          onClick={() => onNav("config")}
          icon={<Settings className="w-4 h-4 shrink-0" />}
          label="设置"
        />
      </div>

      {/* 视图编辑 Drawer */}
      <ViewEditDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        isEditMode={isEditMode}
        viewName={viewName}
        viewIcon={viewIcon}
        selectedPackIds={selectedPackIds}
        timeWindow={timeWindow}
        sortBy={sortBy}
        saving={saving}
        deleting={deleting}
        deleteConfirmOpen={deleteConfirmOpen}
        packs={packs}
        onViewNameChange={setViewName}
        onViewIconChange={setViewIcon}
        onPackToggle={handlePackToggle}
        onTimeWindowChange={setTimeWindow}
        onSortByChange={setSortBy}
        onSave={saveView}
        onDeleteRequest={() => setDeleteConfirmOpen(true)}
        onDelete={deleteView}
        onDeleteCancel={() => setDeleteConfirmOpen(false)}
      />
    </nav>
  )
}
