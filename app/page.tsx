"use client"

import { useCallback, useState } from "react"
import { Sidebar, type NavId } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { DailyPage } from "@/components/daily-page"
import { WeeklyPage } from "@/components/weekly-page"
import { CustomViewPage } from "@/components/custom-view-page"
import { SavedPage } from "@/components/saved-page"
import { ConfigPage } from "@/components/config-page"
import { ReadingPanel } from "@/components/reading-panel"
import { SaveToast } from "@/components/save-toast"
import { useSaved } from "@/hooks/use-saved"
import type { Article } from "@/lib/types"

export default function LensApp() {
  const [activeNav, setActiveNav] = useState<NavId>("daily")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openArticle, setOpenArticle] = useState<Article | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  })

  const { savedIds, toggleSave, isSaved } = useSaved()

  const handleToggleSave = useCallback(
    (id: string) => {
      const wasSaved = isSaved(id)
      toggleSave(id)
      setToast({
        visible: true,
        message: wasSaved ? "已取消收藏" : "已加入收藏夹",
      })
    },
    [isSaved, toggleSave]
  )

  const handleOpenArticle = useCallback((article: Article) => {
    setOpenArticle(article)
    setPanelOpen(true)
  }, [])

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false)
    setTimeout(() => setOpenArticle(null), 320)
  }, [])

  const renderContent = () => {
    const props = {
      isSaved,
      onToggleSave: handleToggleSave,
      onOpenArticle: handleOpenArticle,
    }

    switch (activeNav) {
      case "daily":
        return <DailyPage {...props} />
      case "weekly":
        return <WeeklyPage {...props} />
      case "view-morning":
      case "view-fish":
        return <CustomViewPage viewId={activeNav} {...props} />
      case "saved":
        return (
          <SavedPage
            savedIds={savedIds}
            isSaved={isSaved}
            onToggleSave={handleToggleSave}
            onOpenArticle={handleOpenArticle}
          />
        )
      case "config":
        return <ConfigPage />
      default:
        return <DailyPage {...props} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeNav={activeNav}
        onNav={setActiveNav}
        savedCount={savedIds.size}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar activeNav={activeNav} />

        <main className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
          {renderContent()}
        </main>
      </div>

      <ReadingPanel
        article={openArticle}
        open={panelOpen}
        onClose={handleClosePanel}
        isSaved={isSaved}
        onToggleSave={handleToggleSave}
      />

      <SaveToast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </div>
  )
}
