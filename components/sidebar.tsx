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
  Pencil,
  GripVertical,
  Trash2,
  Code,
  Terminal,
  Cpu,
  Database,
  Music,
  Video,
  Camera,
  Image,
  MessageSquare,
  Mail,
  Bell,
  Compass,
  Map,
  Globe,
  Star,
  Heart,
  Flame,
  Sparkles,
} from "lucide-react"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export type NavId = string

interface CustomView {
  id: string
  name: string
  icon: string
  order?: number
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

// 扩展图标映射（约 20 个图标）
const ICON_MAP: Record<string, LucideIcon> = {
  // Productivity
  coffee: Coffee,
  zap: Zap,
  sun: Sun,
  book: BookOpen,
  bookmark: Bookmark,
  // Tech
  code: Code,
  terminal: Terminal,
  cpu: Cpu,
  database: Database,
  // Media
  music: Music,
  video: Video,
  camera: Camera,
  image: Image,
  // Communication
  message: MessageSquare,
  mail: Mail,
  bell: Bell,
  // Navigation
  compass: Compass,
  map: Map,
  globe: Globe,
  // Misc
  star: Star,
  heart: Heart,
  flame: Flame,
  sparkles: Sparkles,
  // Default
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

// 可排序视图项组件
interface SortableViewItemProps {
  view: CustomView
  active: boolean
  collapsed: boolean
  onNav: (id: NavId) => void
  onEdit: (view: CustomView) => void
}

function SortableViewItem({ view, active, collapsed, onNav, onEdit }: SortableViewItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <NavButton
        active={active}
        collapsed={collapsed}
        onClick={() => onNav(view.id)}
        icon={getIconComponent(view.icon)}
        label={view.name}
      />
      {!collapsed && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded hover:bg-accent cursor-grab active:cursor-grabbing"
            title="拖拽排序"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(view)
            }}
            className="p-1 rounded hover:bg-accent"
            title="编辑视图"
          >
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  )
}

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
        const packIds = viewData.packs?.map((p: { packId: string }) => p.packId) || []
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
          alert(data.error || "更新视图失败")
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
          alert(data.error || "创建视图失败")
        }
      }
    } catch (error) {
      console.error("Failed to save view:", error)
      alert("保存视图失败")
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
        alert(data.error || "删除视图失败")
      }
    } catch (error) {
      console.error("Failed to delete view:", error)
      alert("删除视图失败")
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
      <Drawer direction="right" open={drawerOpen} onOpenChange={handleDrawerClose}>
        <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-80 rounded-none border-l data-[vaul-drawer-direction=right]:border-l">
          <DrawerHeader>
            <DrawerTitle>{isEditMode ? "编辑视图" : "创建视图"}</DrawerTitle>
            <DrawerDescription>
              {isEditMode ? "修改视图配置" : "创建新的自定义视图"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            {/* 视图名称 */}
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-1.5">
                视图名称
              </label>
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="例如：技术文章、产品更新"
                className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    saveView()
                  }
                }}
              />
            </div>

            {/* 图标选择 */}
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-2">
                图标
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {Object.entries(ICON_MAP).map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setViewIcon(name)}
                    className={cn(
                      "p-2 rounded-lg border transition-colors",
                      viewIcon === name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Pack 选择 */}
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-2">
                选择 Pack ({packs.length} 个可用)
              </label>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {packs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">暂无 Pack 可选</p>
                ) : (
                  packs.map((pack) => (
                    <label
                      key={pack.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded px-2 py-1.5 transition-colors"
                    >
                      <Checkbox
                        checked={selectedPackIds.has(pack.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedPackIds)
                          if (checked) {
                            newSet.add(pack.id)
                          } else {
                            newSet.delete(pack.id)
                          }
                          setSelectedPackIds(newSet)
                        }}
                      />
                      <span className="text-sm font-sans">{pack.name}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedPackIds.size > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  已选择 {selectedPackIds.size} 个 Pack
                </p>
              )}
            </div>

            {/* 时间范围和排序 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1.5">
                  时间范围
                </label>
                <Select value={timeWindow} onValueChange={(v) => setTimeWindow(v as ViewFilter["timeWindow"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">今天</SelectItem>
                    <SelectItem value="week">本周</SelectItem>
                    <SelectItem value="month">本月</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-sans text-muted-foreground mb-1.5">
                  排序方式
                </label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as ViewFilter["sortBy"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ranked">按相关度</SelectItem>
                    <SelectItem value="recent">按时间</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DrawerFooter>
            {isEditMode && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                删除视图
              </Button>
            )}
            <div className="flex gap-2">
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1">
                  取消
                </Button>
              </DrawerClose>
              <Button
                className="flex-1"
                onClick={saveView}
                disabled={saving || !viewName.trim()}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditMode ? "保存" : "创建"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除视图 "{viewName}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteView}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              删除
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
