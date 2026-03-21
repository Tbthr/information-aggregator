/**
 * Weekly Review 视图模块
 * 查询 7 天窗口的内容并聚合主题
 */

import type { ViewModel, ViewModelItem } from "./registry";
import { createLogger } from "../utils/logger";

const logger = createLogger("views:weekly-review");

/**
 * Weekly Review 视图选项
 */
export interface WeeklyReviewOptions {
  /** 时间窗口天数（默认 7） */
  windowDays?: number;
  /** 数据库实例（必需） */
  db: unknown;
}

/**
 * 周报主题聚合
 */
export interface WeeklyTopic {
  /** 主题名称（AI 生成或关键词聚合） */
  name: string;
  /** 相关标签 */
  tags: string[];
  /** 关键词 */
  keywords: string[];
  /** 代表内容（3-5 条） */
  items: WeeklyReviewItem[];
  /** 条目数 */
  count: number;
}

/**
 * 周报条目
 */
export interface WeeklyReviewItem extends ViewModelItem {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
  sourceId?: string;
  tags?: string[];
  packId?: string;
}

/**
 * 周报概览统计
 */
export interface WeeklyOverview {
  /** 总内容数 */
  totalCount: number;
  /** 保留内容数（通过 filter_judgment） */
  retainedCount: number;
  /** 保留率 */
  retentionRate: number;
  /** 平均质量分（如有） */
  avgQualityScore?: number;
  /** 窗口开始日期 */
  windowStart: string;
  /** 窗口结束日期 */
  windowEnd: string;
}

/**
 * 编辑精选内容
 */
export interface EditorPick {
  id: string;
  itemId: string;
  savedAt: string;
  title: string;
  url: string;
  packId?: string;
}

/**
 * Weekly Review 视图模型
 */
export interface WeeklyReviewViewModel extends ViewModel {
  viewId: "weekly-review";
  title: string;
  /** 周报概览 */
  overview: WeeklyOverview;
  /** 主题聚合（3-5 个主题） */
  topics: WeeklyTopic[];
  /** 编辑精选（用户保存的内容） */
  editorPicks: EditorPick[];
  /** 所有条目（按日期分组） */
  itemsByDate: Map<string, WeeklyReviewItem[]>;
}

/**
 * 查询原始条目（用于周报）
 */
interface RawItemRow {
  id: string;
  canonical_url: string;
  normalized_title: string;
  normalized_text: string;
  source_id: string;
  processed_at: string;
}

/**
 * 查询 enrichment 结果（用于获取 tags 和 filter_judgment）
 */
interface EnrichmentRow {
  normalized_item_id: string;
  ai_enrichment_json: string | null;
  filter_judgment_json: string | null;
}

/**
 * 查询保存的内容（编辑精选）
 */
interface SavedItemRow {
  id: string;
  item_id: string;
  pack_id: string | null;
  saved_at: string;
}

/**
 * AI Enrichment 结果结构
 */
interface AiEnrichment {
  tags?: string[];
}

/**
 * Filter Judgment 结构
 */
interface FilterJudgment {
  keepDecision: boolean;
}

/**
 * 构建 Weekly Review 视图
 * @deprecated SQLite 依赖已移除，暂不可用
 */
export async function buildWeeklyReview(
  _options: WeeklyReviewOptions,
): Promise<WeeklyReviewViewModel> {
  logger.warn("weekly-review view is deprecated (SQLite removed)");

  return {
    viewId: "weekly-review",
    title: "Weekly Review (deprecated)",
    overview: {
      totalCount: 0,
      retainedCount: 0,
      retentionRate: 0,
      windowStart: "",
      windowEnd: "",
    },
    topics: [],
    editorPicks: [],
    itemsByDate: new Map(),
    sections: [],
  };
}

