"use client"

import { ReactNode } from "react"
import { Sidebar, type NavId } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { ReadingPanel } from "@/components/reading-panel"
import { SaveToast } from "@/components/save-toast"
import { useSaved } from "@/hooks/use-saved"
import type { Article } from "@/lib/types"
import { useCallback, useState } from "react"

interface PageProps {
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  onOpenArticle: (article: Article) => void
}

interface AppLayoutProps {
  children: ReactNode | ((props: PageProps) => ReactNode)
  activeNav: NavId
  onNav?: (navId: NavId) => void
}

export function AppLayout({ children, activeNav, onNav }: AppLayoutProps) {
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

  const handleNav = useCallback(
    (navId: NavId) => {
      if (onNav) {
        onNav(navId)
      }
    },
    [onNav]
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeNav={activeNav}
        onNav={handleNav}
        savedCount={savedIds.size}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar activeNav={activeNav} />

        <main className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
          {typeof children === "function"
            ? children({
                isSaved,
                onToggleSave: handleToggleSave,
                onOpenArticle: handleOpenArticle,
              })
            : children}
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
