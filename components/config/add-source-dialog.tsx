"use client"

import { Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { SOURCE_TYPE_CATEGORIES } from "./source-type-categories"

interface AddSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  topicName: string
  newSourceKind: string
  newSourceUrl: string
  creatingSource: boolean
  onSourceKindChange: (value: string) => void
  onSourceUrlChange: (value: string) => void
  onCreate: () => void
}

export function AddSourceDialog({
  open,
  onOpenChange,
  topicName,
  newSourceKind,
  newSourceUrl,
  creatingSource,
  onSourceKindChange,
  onSourceUrlChange,
  onCreate,
}: AddSourceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>添加数据源</AlertDialogTitle>
          <AlertDialogDescription>
            为 {topicName} 添加新的数据源。
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
                        onClick={() => onSourceKindChange(type.value)}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200",
                          newSourceKind === type.value
                            ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                            : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card hover:shadow-sm"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                          newSourceKind === type.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {typeof type.icon === "string"
                            ? <span className="text-[10px] font-bold">{type.icon}</span>
                            : <type.icon className="w-3.5 h-3.5" />}
                        </div>
                        <p className={cn(
                          "text-[10px] font-medium text-center leading-tight",
                          newSourceKind === type.value ? "text-primary" : "text-foreground"
                        )}>
                          {type.label}
                        </p>
                        {newSourceKind === type.value && (
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
              onChange={(e) => onSourceUrlChange(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onCreate()
                }
              }}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { onOpenChange(false); onSourceUrlChange("") }}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onCreate} disabled={creatingSource || !newSourceUrl.trim()}>
            {creatingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            添加
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
