"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AuthConfigData {
  adapter: string
  hasConfig: boolean
}

export function AuthConfigSection() {
  const [config, setConfig] = useState<AuthConfigData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/auth-config")
        const data = await res.json()
        if (data.success) {
          setConfig(data.data)
        }
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

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
            <Button variant="outline" size="sm" className="mt-2">
              编辑配置
            </Button>
          </div>
        ) : (
          <div className="text-muted-foreground">
            无认证配置
            <Button variant="outline" size="sm" className="ml-2">
              添加配置
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
