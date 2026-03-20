"use client"

import useSWR, { SWRConfiguration } from "swr"
import type { Article, NewsFlash, DailyOverview } from "@/lib/types"

// ============ Types ============

interface Pack {
  id: string
  name: string
  description?: string | null
}

interface CustomView {
  id: string
  name: string
  icon: string
  description?: string
  packs?: Array<{ packId: string; pack?: { id: string; name: string } }>
}

interface DailyData {
  overview: DailyOverview | null
  articles: Article[]
  newsFlashes: NewsFlash[]
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ============ Fetcher ============

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json: ApiResponse<T> = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`)
  }

  return json.data as T
}

// ============ Default SWR Config ============

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,    // 窗口聚焦不重新验证
  revalidateOnReconnect: true, // 网络重连时重新验证
  dedupingInterval: 5000,      // 5秒内相同请求去重
}

// ============ Hooks ============

interface PacksResponse {
  packs: Pack[]
}

export function usePacks() {
  return useSWR<Pack[]>("/api/packs", (url) => fetcher<PacksResponse>(url).then((d) => d.packs), defaultConfig)
}

interface CustomViewsResponse {
  views: CustomView[]
}

export function useCustomViews() {
  return useSWR<CustomView[]>("/api/custom-views", (url) => fetcher<CustomViewsResponse>(url).then((d) => d.views), defaultConfig)
}

interface BookmarksResponse {
  items: Article[]
  total: number
}

export function useBookmarks() {
  return useSWR<Article[]>("/api/bookmarks", (url) => fetcher<BookmarksResponse>(url).then((d) => d.items), defaultConfig)
}

export function useDaily() {
  return useSWR<DailyData>("/api/daily", fetcher<DailyData>, defaultConfig)
}
