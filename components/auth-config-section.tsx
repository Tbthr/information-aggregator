"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuthConfigData {
  adapter: string
  hasConfig: boolean
}

interface AuthConfigSectionProps {
  packId: string
}

export function AuthConfigSection({ packId }: AuthConfigSectionProps) {
  const [config, setConfig] = useState<AuthConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [adapter, setAdapter] = useState("x-family")
  const [configJson, setConfigJson] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/auth-config?packId=${packId}`)
        const data = await res.json()
        if (data.success) {
          setConfig(data.data)
          if (data.data) {
            setAdapter(data.data.adapter || "x-family")
          }
        }
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [packId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/auth-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, adapter, configJson }),
      })
      const data = await res.json()
      if (data.success) {
        setConfig({ adapter, hasConfig: !!configJson })
        setDialogOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">加载中...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">认证配置</CardTitle>
      </CardHeader>
      <CardContent>
        {config ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">适配器:</span>
              <span className="font-mono text-sm">{config.adapter}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">配置状态:</span>
              <span className={config.hasConfig ? "text-green-600" : "text-muted-foreground"}>
                {config.hasConfig ? "已配置" : "无"}
              </span>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2">
                  编辑配置
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>编辑认证配置</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="adapter">适配器</Label>
                    <Input
                      id="adapter"
                      value={adapter}
                      onChange={(e) => setAdapter(e.target.value)}
                      placeholder="x-family"
                    />
                  </div>
                  <div>
                    <Label htmlFor="configJson">配置 JSON</Label>
                    <Input
                      id="configJson"
                      value={configJson}
                      onChange={(e) => setConfigJson(e.target.value)}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="text-muted-foreground">
            无认证配置
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-2">
                  添加配置
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加认证配置</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="adapter">适配器</Label>
                    <Input
                      id="adapter"
                      value={adapter}
                      onChange={(e) => setAdapter(e.target.value)}
                      placeholder="x-family"
                    />
                  </div>
                  <div>
                    <Label htmlFor="configJson">配置 JSON</Label>
                    <Input
                      id="configJson"
                      value={configJson}
                      onChange={(e) => setConfigJson(e.target.value)}
                      placeholder='{"key": "value"}'
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
