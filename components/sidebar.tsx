"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { usePacks, useCustomViews } from "@/hooks/use-api"
import {
  Sun,
  BookOpen,
  Coffee,
  Zap,
  Plus,
  Bookmark,
  Settings,
  Rss,
  PanelLeftClose,
  PanelLeft,
  LucideIcon,
  Loader2,
  Check,
  Pencil,
} from "lucide-react"
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

export type NavId = string

interface CustomView {
  id: string
  name: string
  icon: string
}

interface Pack {
  id: string
  name: string
  description?: string | null
}

// FilterJson 配置类型
interface ViewFilter {
  timeWindow?: "today" | "week" | "month"
  sortBy?: "ranked" | "recent"
}

// Icon mapping for dynamic custom views
const ICON_MAP: Record<string, LucideIcon> = {
  coffee: Coffee,
  zap: Zap,
  sun: Sun,
  book: BookOpen,
  bookmark: Bookmark,
  settings: Settings,
  rss: Rss,
}

function getIconComponent(iconName: string) {
  const Icon = ICON_MAP[iconName] || Zap
  return <Icon className="w-4 h-4 shrink-0" />
}

interface SidebarProps {
  activeNav: NavId
  onNav: (id: NavId) => void
  savedCount: number
  collapsed: boolean
  onToggleCollapse: () => void
}

const EDITIONS = [
  { id: "daily" as NavId, label: "每日晨报", sublabel: "The Daily", icon: Sun },
  { id: "weekly" as NavId, label: "周末特刊", sublabel: "The Weekly", icon: BookOpen },
]

export function Sidebar({ activeNav, onNav, savedCount, collapsed, onToggleCollapse }: SidebarProps) {
  // SWR hooks
  const { data: customViews = [], isLoading: viewsLoading, mutate: mutateCustomViews } = useCustomViews()
  const { data: packs = [] } = usePacks()

  const [createViewOpen, setCreateViewOpen] = useState(false)
  const [newViewName, setNewViewName] = useState("")
  const [newViewIcon, setNewViewIcon] = useState("zap")
  const [creating, setCreating] = useState(false)
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set())
  // 新建视图的 filter 配置
  const [newViewTimeWindow, setNewViewTimeWindow] = useState<ViewFilter["timeWindow"]>("week")
  const [newViewSortBy, setNewViewSortBy] = useState<ViewFilter["sortBy"]>("ranked")
  // 编辑视图状态
  const [editViewOpen, setEditViewOpen] = useState(false)
  const [editingView, setEditingView] = useState<CustomView | null>(null)
  const [editViewName, setEditViewName] = useState("")
  const [editViewIcon, setEditViewIcon] = useState("")
  const [editSelectedPackIds, setEditSelectedPackIds] = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState(false)
  // 编辑视图的 filter 配置
  const [editViewTimeWindow, setEditViewTimeWindow] = useState<ViewFilter["timeWindow"]>("week")
  const [editViewSortBy, setEditViewSortBy] = useState<ViewFilter["sortBy"]>("ranked")

  const createView = async () => {
    if (!newViewName.trim()) return

    setCreating(true)
    try {
      const filterJson: ViewFilter = {
        timeWindow: newViewTimeWindow,
        sortBy: newViewSortBy,
      }
      const response = await fetch("/api/custom-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newViewName,
          icon: newViewIcon,
          description: "",
          packIds: Array.from(selectedPackIds),
          filterJson: JSON.stringify(filterJson),
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        mutateCustomViews() // Revalidate SWR cache
        setCreateViewOpen(false)
        setNewViewName("")
        setNewViewIcon("zap")
        setSelectedPackIds(new Set())
        setNewViewTimeWindow("week")
        setNewViewSortBy("ranked")
      } else {
        alert(data.error || "创建视图失败")
      }
    } catch (error) {
      console.error("Failed to create view:", error)
      alert("创建视图失败")
    } finally {
      setCreating(false)
    }
  }

  // 打开编辑视图对话框
  const openEditView = async (view: CustomView) => {
    // 获取视图详情（包含 packs）
    try {
      const response = await fetch(`/api/custom-views/${view.id}`)
      const data = await response.json()
      if (data.success && data.data) {
        const viewData = data.data
        setEditingView(viewData)
        setEditViewName(viewData.name)
        setEditViewIcon(viewData.icon || "zap")
        // 设置已选中的 pack IDs
        const packIds = viewData.packs?.map((p: { packId: string }) => p.packId) || []
        setEditSelectedPackIds(new Set(packIds))
        // 解析 filterJson
        if (viewData.filterJson) {
          try {
            const filter = JSON.parse(viewData.filterJson) as ViewFilter
            setEditViewTimeWindow(filter.timeWindow || "week")
            setEditViewSortBy(filter.sortBy || "ranked")
          } catch {
            setEditViewTimeWindow("week")
            setEditViewSortBy("ranked")
          }
        } else {
          setEditViewTimeWindow("week")
          setEditViewSortBy("ranked")
        }
        setEditViewOpen(true)
      }
    } catch (error) {
      console.error("Failed to load view details:", error)
      alert("加载视图详情失败")
    }
  }

  // 更新视图
  const updateView = async () => {
    if (!editingView || !editViewName.trim()) return

    setUpdating(true)
    try {
      const filterJson: ViewFilter = {
        timeWindow: editViewTimeWindow,
        sortBy: editViewSortBy,
      }
      const response = await fetch(`/api/custom-views/${editingView.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editViewName,
          icon: editViewIcon,
          packIds: Array.from(editSelectedPackIds),
          filterJson: JSON.stringify(filterJson),
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        mutateCustomViews() // Revalidate SWR cache
        setEditViewOpen(false)
        setEditingView(null)
      } else {
        alert(data.error || "更新视图失败")
      }
    } catch (error) {
      console.error("Failed to update view:", error)
      alert("更新视图失败")
    } finally {
      setUpdating(false)
    }
  }

  return (
    <nav
      className={cn(
        "h-full flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out overflow-hidden shrink-0",
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

        {/* 我的视图 */}
        <section>
          {!collapsed && (
            <div className="px-4 mb-1 flex items-center justify-between">
              <p className="text-[10px] font-sans font-semibold tracking-widest uppercase text-muted-foreground">
                我的视图
              </p>
              <button
                onClick={() => setCreateViewOpen(true)}
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
          ) : (
            customViews.map((view) => (
              <div key={view.id} className="relative group">
                <NavButton
                  active={activeNav === view.id}
                  collapsed={collapsed}
                  onClick={() => onNav(view.id)}
                  icon={getIconComponent(view.icon)}
                  label={view.name}
                />
                {!collapsed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditView(view)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
                    title="编辑视图"
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))
          )}
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

      {/* 创建视图对话框 */}
      <AlertDialog open={createViewOpen} onOpenChange={setCreateViewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>创建自定义视图</AlertDialogTitle>
            <AlertDialogDescription>
              创建一个新的自定义视图，用于聚合特定来源的内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-1">
                视图名称
              </label>
              <input
                type="text"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="例如：技术文章、产品更新"
                className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    createView()
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-2">
                图标
              </label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(ICON_MAP).map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setNewViewIcon(name)}
                    className={cn(
                      "p-2 rounded-lg border transition-colors",
                      newViewIcon === name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-2">
                选择 Pack ({packs.length} 个可用)
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {packs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">暂无 Pack 可选</p>
                ) : (
                  packs.map((pack) => (
                    <label
                      key={pack.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded px-2 py-1 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPackIds.has(pack.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedPackIds)
                          if (e.target.checked) {
                            newSet.add(pack.id)
                          } else {
                            newSet.delete(pack.id)
                          }
                          setSelectedPackIds(newSet)
                        }}
                        className="w-4 h-4 rounded border-border"
                      />
                      <span className="text-sm font-sans">{pack.name}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedPackIds.size > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  已选择 {selectedPackIds.size} 个 Pack
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  时间范围
                </label>
                <select
                  value={newViewTimeWindow}
                  onChange={(e) => setNewViewTimeWindow(e.target.value as ViewFilter["timeWindow"])}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="today">今天</option>
                  <option value="week">本周</option>
                  <option value="month">本月</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  排序方式
                </label>
                <select
                  value={newViewSortBy}
                  onChange={(e) => setNewViewSortBy(e.target.value as ViewFilter["sortBy"])}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ranked">按相关度</option>
                  <option value="recent">按时间</option>
                </select>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={createView} disabled={creating || !newViewName.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              创建
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑视图对话框 */}
      <AlertDialog open={editViewOpen} onOpenChange={setEditViewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>编辑自定义视图</AlertDialogTitle>
            <AlertDialogDescription>
              修改视图名称、图标和关联的 Pack。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-1">
                视图名称
              </label>
              <input
                type="text"
                value={editViewName}
                onChange={(e) => setEditViewName(e.target.value)}
                placeholder="例如：技术文章、产品更新"
                className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-2">
                图标
              </label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(ICON_MAP).map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setEditViewIcon(name)}
                    className={cn(
                      "p-2 rounded-lg border transition-colors",
                      editViewIcon === name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-2">
                选择 Pack ({packs.length} 个可用)
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {packs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">暂无 Pack 可选</p>
                ) : (
                  packs.map((pack) => (
                    <label
                      key={pack.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded px-2 py-1 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={editSelectedPackIds.has(pack.id)}
                        onChange={(e) => {
                          const newSet = new Set(editSelectedPackIds)
                          if (e.target.checked) {
                            newSet.add(pack.id)
                          } else {
                            newSet.delete(pack.id)
                          }
                          setEditSelectedPackIds(newSet)
                        }}
                        className="w-4 h-4 rounded border-border"
                      />
                      <span className="text-sm font-sans">{pack.name}</span>
                    </label>
                  ))
                )}
              </div>
              {editSelectedPackIds.size > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  已选择 {editSelectedPackIds.size} 个 Pack
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  时间范围
                </label>
                <select
                  value={editViewTimeWindow}
                  onChange={(e) => setEditViewTimeWindow(e.target.value as ViewFilter["timeWindow"])}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="today">今天</option>
                  <option value="week">本周</option>
                  <option value="month">本月</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1">
                  排序方式
                </label>
                <select
                  value={editViewSortBy}
                  onChange={(e) => setEditViewSortBy(e.target.value as ViewFilter["sortBy"])}
                  className="w-full text-sm font-sans bg-background border border-border rounded-lg px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ranked">按相关度</option>
                  <option value="recent">按时间</option>
                </select>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={updateView} disabled={updating || !editViewName.trim()}>
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              保存
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  )
}

interface NavButtonProps {
  active: boolean
  collapsed: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  sublabel?: string
  badge?: number
}

function NavButton({ active, collapsed, onClick, icon, label, sublabel, badge }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 transition-colors duration-150 relative",
        collapsed ? "justify-center px-0 py-2.5" : "px-4 py-2",
        active
          ? "text-sidebar-foreground bg-sidebar-accent"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}
      <span className={cn(active ? "text-primary" : "")}>{icon}</span>
      {!collapsed && (
        <div className="flex-1 text-left">
          <span className="font-sans text-sm leading-none">{label}</span>
          {sublabel && (
            <span className="block text-[10px] text-muted-foreground mt-0.5 font-sans">{sublabel}</span>
          )}
        </div>
      )}
      {!collapsed && badge !== undefined && (
        <span className="text-[10px] font-sans font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1"
          style={{ background: "var(--bullet-bg)", color: "var(--accent-foreground)" }}>
          {badge}
        </span>
      )}
      {collapsed && active && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}
    </button>
  )
}
