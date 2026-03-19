"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchSavedItems } from "@/lib/api-client"

export function useSaved() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Load saved items on mount
  useEffect(() => {
    let mounted = true

    async function loadSavedItems() {
      try {
        const items = await fetchSavedItems()
        if (mounted) {
          setSavedIds(new Set(items.map((item) => item.id)))
        }
      } catch (error) {
        console.error("Failed to load saved items:", error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadSavedItems()

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
    (id: string) => {
      if (savedIds.has(id)) {
        removeSaved(id)
      } else {
        addSaved(id)
      }
    },
    [savedIds, addSaved, removeSaved]
  )

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds])

  return { savedIds, loading, addSaved, removeSaved, toggleSave, isSaved }
}
