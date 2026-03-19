"use client"

import { useState, useCallback } from "react"
import { INITIAL_SAVED_IDS } from "@/lib/mock-data"

export function useSaved() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(INITIAL_SAVED_IDS))

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds])

  return { savedIds, toggleSave, isSaved }
}
