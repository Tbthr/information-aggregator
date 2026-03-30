import { redirect } from "next/navigation"

export default function ConfigRoute() {
  redirect("/settings?tab=sources")
}
