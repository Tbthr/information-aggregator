"use client"

import { useRouter, useParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { CustomViewPage } from "@/components/custom-view-page"
import type { NavId } from "@/components/sidebar"

export default function ViewRoute() {
  const router = useRouter()
  const params = useParams()
  const viewId = params.id as string

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
      default:
        // For custom views, navigate to /view/[id]
        router.push(`/view/${navId}`)
    }
  }

  return (
    <AppLayout activeNav={viewId as NavId} onNav={handleNav}>
      {({ isSaved, onToggleSave, onOpenArticle }) => (
        <CustomViewPage
          viewId={viewId}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          onOpenArticle={onOpenArticle}
        />
      )}
    </AppLayout>
  )
}
