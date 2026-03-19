"use client"

import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { SavedPage } from "@/components/saved-page"
import { useSaved } from "@/hooks/use-saved"
import type { NavId } from "@/components/sidebar"

export default function SavedRoute() {
  const router = useRouter()
  const { savedIds, isSaved, toggleSave } = useSaved()

  const handleNav = (navId: NavId) => {
    switch (navId) {
      case "daily":
        router.push("/daily")
        break
      case "weekly":
        router.push("/weekly")
        break
      case "saved":
        router.push("/saved")
        break
      case "config":
        router.push("/config")
        break
      default:
        router.push("/")
    }
  }

  return (
    <AppLayout activeNav="saved" onNav={handleNav}>
      {({ onOpenArticle }) => (
        <SavedPage
          savedIds={savedIds}
          isSaved={isSaved}
          onToggleSave={toggleSave}
          onOpenArticle={onOpenArticle}
        />
      )}
    </AppLayout>
  )
}
