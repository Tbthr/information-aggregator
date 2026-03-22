"use client"

import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { DailyPage } from "@/components/daily-page"
import type { NavId } from "@/components/sidebar"

export default function HomePage() {
  const router = useRouter()

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
      case "x":
        router.push("/x")
        break
      case "settings/reports":
        router.push("/settings/reports")
        break
      default:
        // For custom views, navigate to /view/[id]
        router.push(`/view/${navId}`)
    }
  }

  return (
    <AppLayout activeNav="daily" onNav={handleNav}>
      {({ isSaved, onToggleSave, onOpenArticle }) => (
        <DailyPage
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          onOpenArticle={onOpenArticle}
        />
      )}
    </AppLayout>
  )
}
