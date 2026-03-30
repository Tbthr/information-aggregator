"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ReportSettingsPage } from "@/components/report-settings-page"
import { ConfigPage } from "@/components/config-page"

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") ?? "daily"

  // Map tab to sidebar nav ID for active highlighting
  const activeNav = tab === "sources" ? "settings-sources" : "settings-daily"

  const handleTabChange = (newTab: string) => {
    router.replace(`/settings?tab=${newTab}`)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">设置</h1>
      </div>

      {/* Tab bar */}
      <div className="px-6 pt-4">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="daily">日报</TabsTrigger>
            <TabsTrigger value="weekly">周报</TabsTrigger>
            <TabsTrigger value="sources">数据源</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4">
            <ReportSettingsPage activeTab="daily" />
          </TabsContent>

          <TabsContent value="weekly" className="mt-4">
            <ReportSettingsPage activeTab="weekly" />
          </TabsContent>

          <TabsContent value="sources" className="mt-0">
            <ConfigPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function SettingsRoute() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") ?? "daily"
  const activeNav = tab === "sources" ? "settings-sources" : "settings-daily"

  return (
    <AppLayout activeNav={activeNav}>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载中...</div>}>
        <SettingsContent />
      </Suspense>
    </AppLayout>
  )
}
