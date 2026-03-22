import { useCallback } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { fetchTweets, addTweetBookmark, removeTweetBookmark } from "@/lib/api-client"
import type { Tweet } from "@/lib/types"

interface UseTweetsParams {
  tab?: string
  window?: "today" | "week" | "month"
  sort?: "ranked" | "recent" | "engagement"
  page?: number
  pageSize?: number
  searchQuery?: string
}

export function useTweets(params: UseTweetsParams = {}) {
  const key = JSON.stringify(params)

  const { data, isLoading, error, mutate } = useSWR(
    key,
    () => fetchTweets(params),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const items = data?.items ?? []
  const total = data?.pagination.total ?? 0
  const savedIds = new Set(items.filter((i) => i.isBookmarked).map((i) => i.id))

  const toggleSave = useCallback(async (id: string) => {
    const currentlySaved = savedIds.has(id)
    try {
      if (currentlySaved) {
        await removeTweetBookmark(id)
      } else {
        await addTweetBookmark(id)
      }
      mutate()
      globalMutate("/api/tweet-bookmarks")
    } catch {
      // Silently fail for bookmark operations
    }
  }, [savedIds, mutate])

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds])

  return {
    items,
    total,
    loading: isLoading,
    error: error?.message ?? null,
    refetch: () => mutate(),
    toggleSave,
    isSaved,
  }
}
