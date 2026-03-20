"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchBookmarks, addBookmark, removeBookmark } from "@/lib/api-client"

export function useSaved() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Load bookmarks on mount
  useEffect(() => {
    let mounted = true

    async function loadBookmarks() {
      try {
        const items = await fetchBookmarks()
        if (mounted) {
          setSavedIds(new Set(items.map((item) => item.id)))
        }
      } catch (error) {
        console.error("Failed to load bookmarks:", error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadBookmarks()

    return () => {
      mounted = false
    }
  }, [])

  const addSaved = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const removeSaved = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggleSave = useCallback(
    async (id: string) => {
      const currentlySaved = savedIds.has(id)
      try {
        if (currentlySaved) {
          const result = await removeBookmark(id)
          if (result.success) {
            setSavedIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            })
          }
        } else {
          const result = await addBookmark(id)
          if (result.success) {
            setSavedIds((prev) => {
              const next = new Set(prev)
              next.add(id)
              return next
            })
          }
        }
      } catch (error) {
        console.error("Failed to toggle bookmark:", error)
      }
    },
    [savedIds]
  )

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds])

  return { savedIds, loading, addSaved, removeSaved, toggleSave, isSaved }
}
