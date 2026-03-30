"use client"

import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { DailyPage } from "@/components/daily-page"
import type { NavId } from "@/components/sidebar"

export default function DailyRoute() {
  const router = useRouter()

  const handleNav = (navId: NavId) => {
    switch (navId) {
      case "daily":
        router.push("/daily")
        break
      case "weekly":
        router.push("/weekly")
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
        router.push("/")
    }
  }

  return (
    <AppLayout activeNav="daily" onNav={handleNav}>
      {({ onOpenArticle }) => (
        <DailyPage
          onOpenArticle={onOpenArticle}
        />
      )}
    </AppLayout>
  )
}
