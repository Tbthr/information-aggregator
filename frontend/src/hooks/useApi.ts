import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import type { ItemsData, PacksData, ApiResponse } from "../types/api";

interface UseItemsOptions {
  packs?: string[];
  window?: string;
  sources?: string[];
  sort?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

interface UseItemsResult {
  data: ApiResponse<ItemsData> | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 获取内容项列表的 hook
 * 使用 debounce 实现搜索防抖
 */
export function useItems(options: UseItemsOptions = {}): UseItemsResult {
  const [data, setData] = useState<ApiResponse<ItemsData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 从 options 中提取 search 用于单独处理
  const { search, ...otherOptions } = options;

  // 稳定的参数序列化（不含 search）
  const otherParamsKey = JSON.stringify(otherOptions);

  // 主要的数据获取逻辑
  const doFetch = async (searchTerm: string | undefined) => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.getItems({
        ...otherOptions,
        search: searchTerm,
        pageSize: options.pageSize ?? 20,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  // 搜索变化时使用防抖
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      doFetch(search);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, otherParamsKey]);

  return {
    data,
    loading,
    error,
    refetch: () => doFetch(search),
  };
}

interface UsePacksResult {
  data: PacksData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 获取 Pack 列表的 hook
 */
export function usePacks(includeStats = false): UsePacksResult {
  const [data, setData] = useState<PacksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await api.getPacks({ includeStats });
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [includeStats]);

  return {
    data,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      api.getPacks({ includeStats })
        .then((result) => {
          setData(result.data);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          setLoading(false);
        });
    },
  };
}
