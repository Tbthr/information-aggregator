"use client"

import { cn } from "@/lib/utils"
import { Trash2, Loader2 } from "lucide-react"
import { ICON_MAP } from "./icon-map"
import type { Pack, ViewFilter } from "./types"
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

export interface ViewEditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit mode flag */
  isEditMode: boolean
  /** View name input value */
  viewName: string
  /** Icon key for the selected icon */
  viewIcon: string
  /** Set of selected pack IDs */
  selectedPackIds: Set<string>
  /** Selected time window */
  timeWindow: ViewFilter["timeWindow"]
  /** Selected sort order */
  sortBy: ViewFilter["sortBy"]
  /** Whether a save operation is in progress */
  saving: boolean
  /** Whether a delete operation is in progress */
  deleting: boolean
  /** Whether the delete confirmation dialog is open */
  deleteConfirmOpen: boolean
  /** Available packs to select from */
  packs: Pack[]
  /** Callback: set view name */
  onViewNameChange: (name: string) => void
  /** Callback: set view icon */
  onViewIconChange: (icon: string) => void
  /** Callback: toggle pack selection */
  onPackToggle: (packId: string, checked: boolean) => void
  /** Callback: set time window */
  onTimeWindowChange: (value: ViewFilter["timeWindow"]) => void
  /** Callback: set sort order */
  onSortByChange: (value: ViewFilter["sortBy"]) => void
  /** Callback: save view */
  onSave: () => void
  /** Callback: request delete confirmation */
  onDeleteRequest: () => void
  /** Callback: confirm delete */
  onDelete: () => void
  /** Callback: cancel delete */
  onDeleteCancel: () => void
}

export function ViewEditDrawer({
  open,
  onOpenChange,
  isEditMode,
  viewName,
  viewIcon,
  selectedPackIds,
  timeWindow,
  sortBy,
  saving,
  deleting,
  deleteConfirmOpen,
  packs,
  onViewNameChange,
  onViewIconChange,
  onPackToggle,
  onTimeWindowChange,
  onSortByChange,
  onSave,
  onDeleteRequest,
  onDelete,
  onDeleteCancel,
}: ViewEditDrawerProps) {
  return (
    <>
      {/* 视图编辑 Drawer */}
      <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
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
                onChange={(e) => onViewNameChange(e.target.value)}
                placeholder="例如：技术文章、产品更新"
                className="w-full text-sm font-sans bg-background border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onSave()
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
                    onClick={() => onViewIconChange(name)}
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
                        onCheckedChange={(checked) => onPackToggle(pack.id, !!checked)}
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
                <Select value={timeWindow} onValueChange={(v) => onTimeWindowChange(v as ViewFilter["timeWindow"])}>
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
                <Select value={sortBy} onValueChange={(v) => onSortByChange(v as ViewFilter["sortBy"])}>
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
                onClick={onDeleteRequest}
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
                onClick={onSave}
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
      <AlertDialog open={deleteConfirmOpen} onOpenChange={onDeleteCancel}>
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
              onClick={onDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
