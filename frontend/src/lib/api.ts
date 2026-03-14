import type { ApiResponse, ItemsData, PacksData, HealthData, ItemData } from "../types/api";

const API_BASE = "/api";

/**
 * API 客户端
 */
export const api = {
  /**
   * 获取内容项列表
   */
  async getItems(params: {
    packs?: string[];
    window?: string;
    sources?: string[];
    sourceTypes?: string[];
    sort?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    minScore?: number;
  } = {}): Promise<ApiResponse<ItemsData>> {
    const query = new URLSearchParams();

    if (params.packs?.length) query.set("packs", params.packs.join(","));
    if (params.window) query.set("window", params.window);
    if (params.sources?.length) query.set("sources", params.sources.join(","));
    if (params.sourceTypes?.length) query.set("sourceTypes", params.sourceTypes.join(","));
    if (params.sort) query.set("sort", params.sort);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.search) query.set("search", params.search);
    if (params.minScore !== undefined) query.set("minScore", String(params.minScore));

    const response = await fetch(`${API_BASE}/items?${query}`);
    return response.json();
  },

  /**
   * 获取单个内容项
   */
  async getItem(id: string): Promise<ApiResponse<ItemData>> {
    const response = await fetch(`${API_BASE}/items/${id}`);
    return response.json();
  },

  /**
   * 获取 Pack 列表
   */
  async getPacks(params: { includeStats?: boolean } = {}): Promise<ApiResponse<PacksData>> {
    const query = new URLSearchParams();
    if (params.includeStats) query.set("includeStats", "true");

    const response = await fetch(`${API_BASE}/packs?${query}`);
    return response.json();
  },

  /**
   * 健康检查
   */
  async getHealth(): Promise<HealthData> {
    const response = await fetch(`${API_BASE}/health`);
    return response.json();
  },
};

/**
 * 格式化相对时间
 */
export function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString("zh-CN");
}

/**
 * 格式化分数
 */
export function formatScore(score: number): string {
  return score.toFixed(1);
}
