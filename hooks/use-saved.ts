"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { addBookmark, removeBookmark } from "@/lib/api-client"

export function useSaved() {
  const { data: savedIds = new Set<string>(), mutate: mutateSavedIds } = useSWR<Set<string>>(
    "/api/bookmarks",
    async (url) => {
      const res = await fetch(url)
      const json = await res.json()
      if (json.success && json.data?.items) {
        return new Set(json.data.items.map((item: { id: string }) => item.id))
      }
      return new Set<string>()
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const toggleSave = useCallback(
    async (id: string) => {
      const currentlySaved = savedIds.has(id)
      try {
        if (currentlySaved) {
          const result = await removeBookmark(id)
          if (result.success) {
            mutateSavedIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            }, false)
          }
        } else {
          const result = await addBookmark(id)
          if (result.success) {
            mutateSavedIds((prev) => {
              const next = new Set(prev)
              next.add(id)
              return next
            }, false)
          }
        }
      } catch (error) {
        console.error("Failed to toggle bookmark:", error)
      }
    },
    [savedIds, mutateSavedIds]
  )

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds])

  return { savedIds, toggleSave, isSaved }
}
