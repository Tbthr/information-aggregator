"use client"

import { useMemo, useCallback } from "react"
import useSWR from "swr"
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

function buildItemsKey(params: UseItemsParams): string {
  return JSON.stringify({
    packs: params.packId,
    sources: params.sourceId,
    sourceTypes: params.sourceType,
    window: params.window,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    search: params.searchQuery,
  })
}

export function useItems(params: UseItemsParams = {}): UseItemsResult {
  const key = buildItemsKey(params)

  const { data, isLoading, error, mutate } = useSWR(
    key,
    () => {
      const apiParams: FetchItemsParams = {
        page: params.page,
        pageSize: params.pageSize,
        window: params.window,
        sort: params.sort,
        search: params.searchQuery,
        packs: params.packId,
        sources: params.sourceId,
        sourceTypes: params.sourceType,
      }
      return fetchItems(apiParams)
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const { savedIds, toggleSave: toggleSaveFromHook, isSaved } = useSaved()

  const itemsWithBookmarkedState = useMemo(() => {
    return (data?.items ?? []).map((item) => ({
      ...item,
      isBookmarked: savedIds.has(item.id),
    }))
  }, [data?.items, savedIds])

  const toggleSave = useCallback(
    async (id: string) => {
      await toggleSaveFromHook(id)
    },
    [toggleSaveFromHook]
  )

  return {
    items: itemsWithBookmarkedState,
    total: data?.pagination.total ?? 0,
    loading: isLoading,
    error: error?.message ?? null,
    refetch: () => mutate(),
    toggleSave,
    isSaved,
  }
}
