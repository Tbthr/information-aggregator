"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Pencil, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

type Source = { id: string; name: string; url: string | null; type: string; enabled: boolean; packId: string | null; description?: string | null }

interface SourceEditDialogProps {
  source: Source | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updatedSource: Source) => void
}

export function SourceEditDialog({ source, open, onOpenChange, onSave }: SourceEditDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [url, setUrl] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!source || !open) return

    setName(source.name)
    setUrl(source.url || "")
    setDescription("")
  }, [source, open])

  const handleSave = async () => {
    if (!source) return
    setSaving(true)

    try {
      const sourceRes = await fetch(`/api/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, description: description || null }),
      })
      const sourceData = await sourceRes.json()

      if (sourceRes.ok && sourceData.success) {
        onSave({ ...source, name, url, description })
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Failed to save source:", error)
      toast({ title: "保存失败", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            编辑数据源
          </DialogTitle>
          <DialogDescription>修改数据源配置</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              名称
            </Label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              URL
            </Label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow font-mono mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              类型
            </Label>
            <input
              type="text"
              value={source?.type || ""}
              disabled
              className="w-full text-sm font-sans bg-muted border border-border rounded-lg px-3 py-2 text-muted-foreground cursor-not-allowed mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
              描述
            </Label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选的数据源描述..."
              className="w-full text-sm font-sans bg-card border border-border rounded-lg px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring resize-none transition-shadow mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
