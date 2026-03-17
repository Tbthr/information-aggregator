/**
 * Source Detail 视图模块
 * 查询单个来源的策略和效果
 */

import type { Database } from "bun:sqlite";
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
  db: Database;
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
 * @param options - 视图选项
 * @returns 来源详情视图模型
 */
export async function buildSourceDetail(
  options: SourceDetailOptions,
): Promise<SourceDetailViewModel | null> {
  const { sourceId, db, windowDays = 7 } = options;

  logger.info("Building source detail", { sourceId, windowDays });

  // 查询来源元信息
  const source = await querySourceMeta(db, sourceId);
  if (!source) {
    logger.warn("Source not found", { sourceId });
    return null;
  }

  // 查询策略信息
  const policy = await querySourcePolicy(db, sourceId);

  // 计算时间窗口
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // 查询窗口内的条目
  const items = await querySourceItems(db, sourceId, windowStart);

  // 查询 enrichment 结果
  const enrichmentMap = await queryEnrichmentMap(db, items.map((i) => i.id));

  // 合并条目和 enrichment 数据
  const sourceItems: SourceItem[] = items.map((item) => {
    const enrichment = enrichmentMap.get(item.id);
    const judgment = enrichment?.filterJudgment;

    return {
      id: item.id,
      title: item.normalized_title,
      url: item.canonical_url,
      publishedAt: item.processed_at,
      keepDecision: judgment?.keepDecision,
      keepReason: judgment?.keepReason,
      readerBenefit: judgment?.readerBenefit,
      readingHint: judgment?.readingHint,
    };
  });

  // 计算统计信息
  const retainedItems = sourceItems.filter((item) => item.keepDecision !== false);
  const totalItems = sourceItems.length;
  const retentionRate = totalItems > 0 ? retainedItems.length / totalItems : 0;

  // 统计过滤理由
  const filterReasons = calculateFilterReasonStats(sourceItems);

  return {
    viewId: "source-detail",
    title: `Source: ${source.type}`,
    source,
    policy,
    stats: {
      totalItems,
      retainedItems: retainedItems.length,
      retentionRate,
    },
    filterReasons,
    recentItems: sourceItems.slice(0, 10), // 最近 10 条
    sections: [
      {
        title: "Recent Items",
        items: sourceItems.slice(0, 10),
      },
    ],
  };
}

/**
 * 查询来源元信息
 */
async function querySourceMeta(db: Database, sourceId: string): Promise<SourceMeta | null> {
  // 先尝试从 sources 表查询
  const sourceStmt = db.prepare(`
    SELECT id, type, url, enabled FROM sources WHERE id = ?
  `);
  const sourceRow = sourceStmt.get(sourceId) as {
    id: string;
    type: string;
    url: string;
    enabled: number;
  } | undefined;

  if (sourceRow) {
    return {
      id: sourceRow.id,
      type: sourceRow.type,
      url: sourceRow.url,
      enabled: sourceRow.enabled === 1,
    };
  }

  // 如果未找到，从 raw_items 表获取元信息
  const metaStmt = db.prepare(`
    SELECT
      si.source_id as id,
      json_extract(ri.metadata_json, '$.sourceType') as type,
      json_extract(ri.metadata_json, '$.packId') as packId,
      json_extract(ri.metadata_json, '$.sourceUrl') as url
    FROM raw_items ri
    LEFT JOIN normalized_items si ON si.raw_item_id = ri.id
    WHERE ri.source_id = ?
    LIMIT 1
  `);
  const metaRow = metaStmt.get(sourceId) as {
    id: string;
    type: string;
    packId: string;
    url: string;
  } | undefined;

  if (!metaRow) {
    return null;
  }

  return {
    id: metaRow.id,
    type: metaRow.type || "unknown",
    url: metaRow.url || "",
    packId: metaRow.packId,
    enabled: true, // 默认启用
  };
}

/**
 * 查询来源策略信息
 */
async function querySourcePolicy(db: Database, sourceId: string): Promise<SourcePolicyInfo> {
  // 尝试从 sources 表查询
  const stmt = db.prepare(`
    SELECT policy_json FROM sources WHERE id = ?
  `);
  const row = stmt.get(sourceId) as { policy_json: string | null } | undefined;

  if (row?.policy_json) {
    try {
      const policy = JSON.parse(row.policy_json) as { mode: PolicyMode; filterPrompt?: string };
      return {
        mode: policy.mode || "filter_then_assist",
        filterPrompt: policy.filterPrompt,
      };
    } catch {
      // 解析失败，使用默认值
    }
  }

  // 默认策略
  return {
    mode: "filter_then_assist",
  };
}

/**
 * 查询来源条目（时间窗口内）
 */
async function querySourceItems(
  db: Database,
  sourceId: string,
  windowStart: string,
): Promise<RawItemRow[]> {
  const stmt = db.prepare(`
    SELECT id, canonical_url, normalized_title, processed_at, source_id
    FROM normalized_items
    WHERE source_id = ? AND processed_at >= ?
    ORDER BY processed_at DESC
  `);

  const rows = stmt.all(sourceId, windowStart) as RawItemRow[];
  return rows;
}

/**
 * 查询 enrichment 结果映射
 */
async function queryEnrichmentMap(
  db: Database,
  itemIds: string[],
): Promise<Map<string, { filterJudgment?: FilterJudgment }>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  const placeholders = itemIds.map(() => "?").join(",");
  const stmt = db.prepare(`
    SELECT normalized_item_id, filter_judgment_json
    FROM enrichment_results
    WHERE normalized_item_id IN (${placeholders})
  `);

  const rows = stmt.all(...itemIds) as EnrichmentRow[];
  const result = new Map();

  for (const row of rows) {
    const filterJudgment: FilterJudgment | undefined = row.filter_judgment_json
      ? JSON.parse(row.filter_judgment_json)
      : undefined;

    result.set(row.normalized_item_id, { filterJudgment });
  }

  return result;
}

/**
 * 计算过滤理由统计
 */
function calculateFilterReasonStats(items: SourceItem[]): FilterReasonStats[] {
  const reasonMap = new Map<string, number>();

  for (const item of items) {
    if (item.keepDecision === false && item.keepReason) {
      const reason = item.keepReason;
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }
  }

  return Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
