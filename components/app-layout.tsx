"use client"

import { ReactNode, useCallback, useState } from "react"
import { Sidebar, type NavId } from "@/components/sidebar"
import { Topbar } from "@/components/topbar"
import { ReadingPanel } from "@/components/reading-panel"
import { ScrollProgress } from "@/components/scroll-progress"
import type { Article } from "@/lib/types"

interface PageProps {
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
    <div className="flex h-screen overflow-hidden bg-gradient-subtle">
      <ScrollProgress />
      <Sidebar
        activeNav={activeNav}
        onNav={handleNav}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar activeNav={activeNav} />

        <main className="flex-1 overflow-y-auto" style={{ background: "var(--background)" }}>
          {typeof children === "function"
            ? children({ onOpenArticle: handleOpenArticle })
            : children}
        </main>
      </div>

      <ReadingPanel
        article={openArticle}
        open={panelOpen}
        onClose={handleClosePanel}
      />
    </div>
  )
}
