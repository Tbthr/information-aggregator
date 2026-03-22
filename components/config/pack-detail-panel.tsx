"use client"

import { Settings2, Trash2 } from "lucide-react"
import { formatDate } from "@/lib/format-date"
import type { Pack } from "./types"
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

interface PackDetailPanelProps {
  selectedPack: Pack | null
  editingPackName: string
  editingPackDescription: string
  savingPack: boolean
  onEditingPackNameChange: (value: string) => void
  onEditingPackDescriptionChange: (value: string) => void
  onSave: () => void
  onReset: () => void
  onDeletePack: (packId: string) => void
}

export function PackDetailPanel({
  selectedPack,
  editingPackName,
  editingPackDescription,
  savingPack,
  onEditingPackNameChange,
  onEditingPackDescriptionChange,
  onSave,
  onReset,
  onDeletePack,
}: PackDetailPanelProps) {
  return (
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
                onChange={(e) => onEditingPackNameChange(e.target.value)}
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
                onChange={(e) => onEditingPackDescriptionChange(e.target.value)}
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
                    ? formatDate(selectedPack.latestItem)
                    : "-"}
                </div>
                <div className="text-xs text-muted-foreground">最新更新</div>
              </div>
            </div>

            {/* 保存/删除按钮 */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onSave}
                disabled={savingPack}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-sans font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                保存配置
              </button>
              <button
                onClick={onReset}
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
                      onClick={() => onDeletePack(selectedPack.id)}
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
  )
}
