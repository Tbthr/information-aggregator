import { useState, useCallback, useMemo } from "react";
import { fetchTweets, addTweetBookmark, removeTweetBookmark } from "@/lib/api-client";
import type { Tweet } from "@/lib/types";

interface UseTweetsParams {
  tab?: string;
  window?: "today" | "week" | "month";
  sort?: "ranked" | "recent" | "engagement";
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}

export function useTweets(params: UseTweetsParams = {}) {
  const [items, setItems] = useState<Tweet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTweets(params);
      setItems(result.items);
      setTotal(result.pagination.total);
      setSavedIds(new Set(result.items.filter((i) => i.isBookmarked).map((i) => i.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tweets");
    } finally {
      setLoading(false);
    }
  }, [params.tab, params.window, params.sort, params.page, params.pageSize, params.searchQuery]);

  const toggleSave = useCallback(async (id: string) => {
    const isSaved = savedIds.has(id);
    try {
      if (isSaved) {
        await removeTweetBookmark(id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await addTweetBookmark(id);
        setSavedIds((prev) => new Set(prev).add(id));
      }
    } catch {
      // Silently fail for bookmark operations
    }
  }, [savedIds]);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  return { items, total, loading, error, refetch, toggleSave, isSaved };
}
