"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { Article } from "@/lib/types"
import { fetchItems, type FetchItemsParams } from "@/lib/api-client"
import { useSaved } from "./use-saved"

export interface UseItemsParams {
  page?: number
  pageSize?: number
  packId?: string
  sourceId?: string
  sourceType?: string
  window?: "today" | "week" | "month"
  searchQuery?: string
  sort?: "ranked" | "recent"
}

export interface UseItemsResult {
  items: Article[]
  total: number
  loading: boolean
  error: string | null
  refetch: () => void
  toggleSave: (id: string) => Promise<void>
  isSaved: (id: string) => boolean
}

export function useItems(params: UseItemsParams = {}): UseItemsResult {
  const [items, setItems] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { savedIds, toggleSave: toggleSaveFromHook, isSaved } = useSaved()

  // Use ref to track mounted state and prevent race conditions
  const isMountedRef = useRef(true)

  const fetchItemsData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const apiParams: FetchItemsParams = {
        page: params.page,
        pageSize: params.pageSize,
        window: params.window,
        sort: params.sort,
        search: params.searchQuery,
      }

      if (params.packId) {
        apiParams.packs = params.packId
      }
      if (params.sourceId) {
        apiParams.sources = params.sourceId
      }
      if (params.sourceType) {
        apiParams.sourceTypes = params.sourceType
      }

      const result = await fetchItems(apiParams)

      // Only update state if still mounted
      if (isMountedRef.current) {
        // Store items without saved state - derive it at render time
        setItems(result.items as Article[])
        setTotal(result.pagination.total)
      }
    } catch (err) {
      // Only update state if still mounted
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch items")
        setItems([])
        setTotal(0)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
    // Note: savedIds intentionally NOT in deps - it's only used for client-side mapping, not API calls
  }, [params.page, params.pageSize, params.packId, params.sourceId, params.sourceType, params.window, params.searchQuery, params.sort])

  useEffect(() => {
    isMountedRef.current = true
    fetchItemsData()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchItemsData])

  // Derive items with bookmarked state at render time
  const itemsWithBookmarkedState = useMemo(() => {
    return items.map((item) => ({
      ...item,
      isBookmarked: savedIds.has(item.id),
    }))
  }, [items, savedIds])

  const toggleSave = useCallback(
    async (id: string) => {
      await toggleSaveFromHook(id)
    },
    [toggleSaveFromHook]
  )

  const refetch = useCallback(() => {
    fetchItemsData()
  }, [fetchItemsData])

  return {
    items: itemsWithBookmarkedState,
    total,
    loading,
    error,
    refetch,
    toggleSave,
    isSaved,
  }
}
