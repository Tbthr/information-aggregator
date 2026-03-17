/**
 * Weekly Review 视图模块
 * 查询 7 天窗口的内容并聚合主题
 */

import type { Database } from "bun:sqlite";
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
  db: Database;
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
 * @param options - 视图选项
 * @returns 周报视图模型
 */
export async function buildWeeklyReview(
  options: WeeklyReviewOptions,
): Promise<WeeklyReviewViewModel> {
  const { db, windowDays = 7 } = options;

  // 计算时间窗口
  const now = new Date();
  const windowEnd = now.toISOString();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  logger.info("Building weekly review", { windowDays, windowStart, windowEnd });

  // 查询窗口内的所有条目
  const items = await queryItemsInWindow(db, windowStart, windowEnd);

  // 查询 enrichment 结果（tags 和 filter_judgment）
  const enrichmentMap = await queryEnrichmentMap(db, items.map((i) => i.id));

  // 合并条目和 enrichment 数据
  const reviewItems: WeeklyReviewItem[] = items.map((item) => {
    const enrichment = enrichmentMap.get(item.id);
    const aiEnrichment = enrichment?.aiEnrichment;
    const filterJudgment = enrichment?.filterJudgment;

    return {
      id: item.id,
      title: item.normalized_title,
      url: item.canonical_url,
      snippet: item.normalized_text?.slice(0, 200),
      publishedAt: item.processed_at,
      sourceId: item.source_id,
      tags: aiEnrichment?.tags,
    };
  });

  // 过滤出保留的内容
  const retainedItems = reviewItems.filter((item) => {
    const enrichment = enrichmentMap.get(item.id);
    return enrichment?.filterJudgment?.keepDecision !== false;
  });

  // 计算概览统计
  const overview: WeeklyOverview = {
    totalCount: reviewItems.length,
    retainedCount: retainedItems.length,
    retentionRate: reviewItems.length > 0 ? retainedItems.length / reviewItems.length : 0,
    windowStart,
    windowEnd,
  };

  // 按日期分组
  const itemsByDate = groupItemsByDate(retainedItems);

  // 聚合主题
  const topics = aggregateTopics(retainedItems);

  // 查询编辑精选（保存的内容）
  const editorPicks = await queryEditorPicks(db, windowStart, windowEnd, items);

  return {
    viewId: "weekly-review",
    title: `Weekly Review (${windowDays} Days)`,
    overview,
    topics,
    editorPicks,
    itemsByDate,
    sections: [
      {
        title: "Overview",
        items: [],
      },
      {
        title: "Topics",
        items: topics.flatMap((t) => t.items),
      },
      {
        title: "Editor Picks",
        items: editorPicks.map((p) => ({
          id: p.itemId,
          title: p.title,
          url: p.url,
        })),
      },
    ],
  };
}

/**
 * 查询时间窗口内的所有条目
 */
async function queryItemsInWindow(
  db: Database,
  windowStart: string,
  windowEnd: string,
): Promise<RawItemRow[]> {
  const stmt = db.prepare(`
    SELECT id, canonical_url, normalized_title, normalized_text, source_id, processed_at
    FROM normalized_items
    WHERE processed_at >= ? AND processed_at <= ?
    ORDER BY processed_at DESC
  `);

  const rows = stmt.all(windowStart, windowEnd) as RawItemRow[];
  return rows;
}

/**
 * 查询 enrichment 结果映射
 */
async function queryEnrichmentMap(
  db: Database,
  itemIds: string[],
): Promise<Map<string, { aiEnrichment?: AiEnrichment; filterJudgment?: FilterJudgment }>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  const placeholders = itemIds.map(() => "?").join(",");
  const stmt = db.prepare(`
    SELECT normalized_item_id, ai_enrichment_json, filter_judgment_json
    FROM enrichment_results
    WHERE normalized_item_id IN (${placeholders})
  `);

  const rows = stmt.all(...itemIds) as EnrichmentRow[];
  const result = new Map();

  for (const row of rows) {
    const aiEnrichment: AiEnrichment | undefined = row.ai_enrichment_json
      ? JSON.parse(row.ai_enrichment_json)
      : undefined;
    const filterJudgment: FilterJudgment | undefined = row.filter_judgment_json
      ? JSON.parse(row.filter_judgment_json)
      : undefined;

    result.set(row.normalized_item_id, { aiEnrichment, filterJudgment });
  }

  return result;
}

/**
 * 按日期分组条目
 */
function groupItemsByDate(items: WeeklyReviewItem[]): Map<string, WeeklyReviewItem[]> {
  const result = new Map<string, WeeklyReviewItem[]>();

  for (const item of items) {
    const date = item.publishedAt?.split("T")[0] || "unknown";
    if (!result.has(date)) {
      result.set(date, []);
    }
    result.get(date)!.push(item);
  }

  return result;
}

/**
 * 聚合主题（基于 tags 和关键词）
 */
function aggregateTopics(items: WeeklyReviewItem[]): WeeklyTopic[] {
  // 简单实现：按 tags 聚合
  const tagGroups = new Map<string, WeeklyReviewItem[]>();

  for (const item of items) {
    const tags = item.tags || [];
    for (const tag of tags) {
      if (!tagGroups.has(tag)) {
        tagGroups.set(tag, []);
      }
      tagGroups.get(tag)!.push(item);
    }
  }

  // 取前 5 个主题
  const sortedTags = [...tagGroups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  return sortedTags.map(([tag, topicItems]) => ({
    name: tag,
    tags: [tag],
    keywords: [tag],
    items: topicItems.slice(0, 5), // 每个主题最多 5 条代表内容
    count: topicItems.length,
  }));
}

/**
 * 查询编辑精选（用户保存的内容）
 */
async function queryEditorPicks(
  db: Database,
  windowStart: string,
  windowEnd: string,
  items: RawItemRow[],
): Promise<EditorPick[]> {
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const stmt = db.prepare(`
    SELECT id, item_id, pack_id, saved_at
    FROM saved_items
    WHERE saved_at >= ? AND saved_at <= ?
    ORDER BY saved_at DESC
  `);

  const rows = stmt.all(windowStart, windowEnd) as SavedItemRow[];

  const picks = rows
    .map((row): EditorPick | null => {
      const item = itemMap.get(row.item_id);
      if (!item) {
        return null;
      }
      return {
        id: row.id,
        itemId: row.item_id,
        savedAt: row.saved_at,
        title: item.normalized_title,
        url: item.canonical_url,
        packId: row.pack_id || undefined,
      };
    });

  return picks.filter((pick): pick is EditorPick => pick !== null);
}
