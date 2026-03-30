"use client"

import { useMemo } from "react"
import useSWR, { SWRConfiguration } from "swr"
import type { ApiResponse, DailyReportData, WeeklyReportData, Topic, Content } from "@/lib/types"

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

// ============ Prompt Normalization ============

const PROMPT_FIELDS = [
  "filterPrompt",
  "topicPrompt",
  "topicSummaryPrompt",
  "editorialPrompt",
  "pickReasonPrompt",
] as const

function normalizePrompts(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return obj
  const result: Record<string, unknown> = { ...obj }
  for (const key of PROMPT_FIELDS) {
    if (typeof result[key] === "string") {
      result[key] = (result[key] as string).replace(/\\n/g, "\n")
    }
  }
  return result
}

function escapePrompts(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj }
  for (const key of PROMPT_FIELDS) {
    if (typeof result[key] === "string") {
      result[key] = (result[key] as string).replace(/\n/g, "\\n")
    }
  }
  return result
}

// ============ Hooks ============

// ── Topics API Hooks ──

interface TopicsResponse {
  topics: Topic[]
}

export function useTopics() {
  return useSWR<Topic[]>("/api/topics", (url) => fetcher<TopicsResponse>(url).then((d) => d.topics), defaultConfig)
}

// ── Content API Hooks ──

interface ContentResponse {
  contents: Content[]
}

interface FetchContentParams {
  topicIds?: string
  sourceIds?: string
  kinds?: string
  window?: "today" | "week" | "month"
  page?: number
  pageSize?: number
  sort?: "ranked" | "recent"
  search?: string
}

export function useContent(params: FetchContentParams = {}) {
  const sp = new URLSearchParams()
  if (params.topicIds) sp.set("topicIds", params.topicIds)
  if (params.sourceIds) sp.set("sourceIds", params.sourceIds)
  if (params.kinds) sp.set("kinds", params.kinds)
  if (params.window) sp.set("window", params.window)
  if (params.page) sp.set("page", String(params.page))
  if (params.pageSize) sp.set("pageSize", String(params.pageSize))
  if (params.sort) sp.set("sort", params.sort)
  if (params.search) sp.set("search", params.search)

  const key = sp.toString() ? `/api/content?${sp.toString()}` : "/api/content"
  return useSWR<Content[]>(key, (url) => fetcher<ContentResponse>(url).then((d) => d.contents), defaultConfig)
}

export function useDaily(date?: string) {
  const key = date ? `/api/daily?date=${date}` : "/api/daily"
  return useSWR<DailyReportData>(key, fetcher<DailyReportData>, defaultConfig)
}

export function useWeekly(week?: string) {
  const key = week ? `/api/weekly?week=${week}` : "/api/weekly"
  return useSWR<WeeklyReportData>(key, fetcher<WeeklyReportData>, defaultConfig)
}

export function useReportSettings() {
  const { data, isLoading, error, mutate } = useSWR<{
    daily: Record<string, unknown>
    weekly: Record<string, unknown>
  }>("/api/settings/reports", fetcher, defaultConfig)

  // Normalize prompts: convert \\n to \n for display/edit
  const normalizedData = useMemo(
    () => ({
      daily: normalizePrompts(data?.daily ?? null),
      weekly: normalizePrompts(data?.weekly ?? null),
    }),
    [data],
  )

  return {
    data: normalizedData,
    isLoading,
    error,
    mutate,
  }
}

export { escapePrompts }
