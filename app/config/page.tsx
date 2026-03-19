"use client"

import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { ConfigPage } from "@/components/config-page"
import type { NavId } from "@/components/sidebar"

export default function ConfigRoute() {
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
      default:
        router.push("/")
    }
  }

  return (
    <AppLayout activeNav="config" onNav={handleNav}>
      <ConfigPage />
    </AppLayout>
  )
}
