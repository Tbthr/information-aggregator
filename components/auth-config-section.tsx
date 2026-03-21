"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, Check, Plus, Pencil } from "lucide-react"

interface AuthConfigData {
  sourceId: string
  hasConfig: boolean
  configJson?: string
}

interface AuthConfigSectionProps {
  sourceId: string
}

export function AuthConfigSection({ sourceId }: AuthConfigSectionProps) {
  const [config, setConfig] = useState<AuthConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [configJson, setConfigJson] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/auth-config?sourceId=${sourceId}`)
        const data = await res.json()
        if (data.success) {
          setConfig(data.data)
          if (data.data) {
            setConfigJson(data.data.configJson || "")
          }
        }
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [sourceId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/auth-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, configJson }),
      })
      const data = await res.json()
      if (data.success) {
        setConfig({ sourceId, hasConfig: !!configJson })
        setDialogOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <span className="font-sans font-medium text-sm">认证配置</span>
        </div>
        {config?.hasConfig && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" />
            已配置
          </span>
        )}
      </div>

      {config ? (
        <div className="space-y-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2 border-border/50 hover:border-primary/30 hover:bg-primary/5">
                <Pencil className="w-3.5 h-3.5" />
                编辑配置
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  编辑认证配置
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="configJson" className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                    配置 JSON
                  </Label>
                  <Input
                    id="configJson"
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    placeholder='{"key": "value"}'
                    className="mt-2 font-mono bg-card/80 backdrop-blur-sm border-border/50 focus:border-primary/50"
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      保存中...
                    </>
                  ) : "保存配置"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3 text-center">暂无认证配置</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2 border-dashed border-2 border-border/50 hover:border-primary/30 hover:bg-primary/5">
                <Plus className="w-3.5 h-3.5" />
                添加配置
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  添加认证配置
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="configJson" className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                    配置 JSON
                  </Label>
                  <Input
                    id="configJson"
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    placeholder='{"key": "value"}'
                    className="mt-2 font-mono bg-card/80 backdrop-blur-sm border-border/50 focus:border-primary/50"
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      保存中...
                    </>
                  ) : "添加配置"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}
