/**
 * Source Detail 视图模块
 * 查询单个来源的策略和效果
 */

import type { ViewModel, ViewModelItem } from "./registry";
import type { PolicyMode } from "../types/policy";
import { createLogger } from "../utils/logger";

const logger = createLogger("views:source-detail");

/**
 * Source Detail 视图选项
 */
export interface SourceDetailOptions {
  /** 来源 ID */
  sourceId: string;
  /** 数据库实例（必需） */
  db: unknown;
  /** 时间窗口天数（默认 7） */
  windowDays?: number;
}

/**
 * 来源元信息
 */
export interface SourceMeta {
  id: string;
  type: string;
  url: string;
  description?: string;
  enabled: boolean;
  packId?: string;
}

/**
 * 来源策略信息
 */
export interface SourcePolicyInfo {
  mode: PolicyMode;
  filterPrompt?: string;
  inheritedFrom?: string; // Pack ID 如果继承自 Pack
}

/**
 * 过滤理由统计
 */
export interface FilterReasonStats {
  /** 理由内容 */
  reason: string;
  /** 数量 */
  count: number;
}

/**
 * 来源条目（带判断结果）
 */
export interface SourceItem extends ViewModelItem {
  id: string;
  title: string;
  url: string;
  publishedAt?: string;
  keepDecision?: boolean;
  keepReason?: string;
  readerBenefit?: string;
  readingHint?: string;
}

/**
 * Source Detail 视图模型
 */
export interface SourceDetailViewModel extends ViewModel {
  viewId: "source-detail";
  title: string;
  /** 来源元信息 */
  source: SourceMeta;
  /** 策略信息 */
  policy: SourcePolicyInfo;
  /** 统计信息 */
  stats: {
    /** 近 7 天总内容数 */
    totalItems: number;
    /** 保留内容数 */
    retainedItems: number;
    /** 保留率 */
    retentionRate: number;
  };
  /** 过滤理由分布 */
  filterReasons: FilterReasonStats[];
  /** 最近 10 条内容 */
  recentItems: SourceItem[];
}

/**
 * 查询原始条目（用于来源详情）
 */
interface RawItemRow {
  id: string;
  canonical_url: string;
  normalized_title: string;
  processed_at: string;
  source_id: string;
}

/**
 * 查询 enrichment 结果（用于获取 filter_judgment）
 */
interface EnrichmentRow {
  normalized_item_id: string;
  filter_judgment_json: string | null;
}

/**
 * Filter Judgment 结构
 */
interface FilterJudgment {
  keepDecision: boolean;
  keepReason: string;
  readerBenefit?: string;
  readingHint?: string;
}

/**
 * 构建 Source Detail 视图
 * @deprecated SQLite 依赖已移除，暂不可用
 */
export async function buildSourceDetail(
  _options: SourceDetailOptions,
): Promise<SourceDetailViewModel | null> {
  logger.warn("source-detail view is deprecated (SQLite removed)");
  return null;
}

