import { Hono } from "hono";
import { createDb } from "../../db/client";
import { queryArchiveByWindow } from "../../archive/upsert";
import { getSavedItems } from "../../db/queries/saved-items";
import { calculateItemScores, type ScoreInfo } from "../scoring";
import type { RawItem } from "../../types/index";
import { buildWeeklyReview } from "../../views/weekly-review";

const app = new Hono();

/**
 * 简化的内容项格式（用于 daily-brief）
 */
interface BriefItem {
  id: string;
  title: string;
  url: string;
  source: {
    id: string;
    type: string;
    packId: string;
  };
  publishedAt: string | null;
  fetchedAt: string;
  snippet: string | null;
  author: string | null;
  score: number;
  scores: ScoreInfo;
}

/**
 * Daily Brief 响应结构
 */
interface DailyBriefData {
  coverStory: BriefItem | null;
  leadStories: BriefItem[];
  topSignals: BriefItem[];
  scanBrief: Array<{ id: string; title: string; url: string; score: number }>;
  savedForLater: BriefItem[];
  meta: {
    generatedAt: string;
    totalItems: number;
    keptItems: number;
    retentionRate: number;
  };
}

/**
 * 将 RawItem 转换为 BriefItem
 */
function toBriefItem(item: RawItem, scoreInfo: ScoreInfo): BriefItem {
  const meta = JSON.parse(item.metadataJson || "{}");
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: {
      id: item.sourceId,
      type: meta.sourceType || "unknown",
      packId: meta.packId || "unknown",
    },
    publishedAt: item.publishedAt ?? null,
    fetchedAt: item.fetchedAt,
    snippet: item.snippet ?? null,
    author: item.author ?? null,
    score: scoreInfo.finalScore,
    scores: scoreInfo,
  };
}

/**
 * GET /api/views/daily-brief - 获取每日简报视图
 *
 * 返回分类后的内容：
 * - coverStory: 最高分内容（1条）
 * - leadStories: 次高分内容（3条）
 * - topSignals: 中等优先级内容（5-10条）
 * - scanBrief: 剩余内容（仅标题）
 * - savedForLater: 用户保存的内容
 */
app.get("/daily-brief", async (c) => {
  const startTime = Date.now();
  const db = createDb("data/archive.db");

  try {
    // 查询今日内容（24小时内）
    const rawItems = queryArchiveByWindow(db, "24h", {
      limit: 100, // 获取足够多的内容用于分类
    });

    // 计算分数并排序
    const itemsWithScores = rawItems.map((item) => {
      const scoreInfo = calculateItemScores(item, {
        now: new Date().toISOString(),
      });
      return { item, scoreInfo };
    });

    // 按分数降序排序
    itemsWithScores.sort((a, b) => b.scoreInfo.finalScore - a.scoreInfo.finalScore);

    const totalItems = itemsWithScores.length;

    // 分类内容
    let coverStory: BriefItem | null = null;
    const leadStories: BriefItem[] = [];
    const topSignals: BriefItem[] = [];
    const scanBrief: Array<{ id: string; title: string; url: string; score: number }> = [];

    for (let i = 0; i < itemsWithScores.length; i++) {
      const { item, scoreInfo } = itemsWithScores[i];

      if (i === 0) {
        // 封面故事：最高分
        coverStory = toBriefItem(item, scoreInfo);
      } else if (i <= 4) {
        // 领导故事：第2-4名
        leadStories.push(toBriefItem(item, scoreInfo));
      } else if (i <= 14) {
        // 热点信号：第5-14名（5-10条）
        topSignals.push(toBriefItem(item, scoreInfo));
      } else {
        // 扫描简报：剩余内容仅保留标题
        scanBrief.push({
          id: item.id,
          title: item.title,
          url: item.url,
          score: scoreInfo.finalScore,
        });
      }
    }

    // 获取已保存内容
    const savedItemRecords = await getSavedItems(db, 20);
    const savedForLater: BriefItem[] = [];

    if (savedItemRecords.length > 0) {
      // 查询已保存的原始内容
      const savedIds = savedItemRecords.map((si) => si.itemId);
      const placeholders = savedIds.map(() => "?").join(",");
      const savedRows = db
        .prepare(`SELECT * FROM raw_items WHERE id IN (${placeholders})`)
        .all(...savedIds) as Record<string, unknown>[];

      // 构建 ID 到 RawItem 的映射
      const savedMap = new Map<string, RawItem>();
      for (const row of savedRows) {
        const rawItem: RawItem = {
          id: String(row.id),
          sourceId: String(row.source_id),
          title: String(row.title),
          url: String(row.url),
          fetchedAt: String(row.fetched_at),
          metadataJson: String(row.metadata_json || "{}"),
          snippet: row.snippet ? String(row.snippet) : undefined,
          publishedAt: row.published_at ? String(row.published_at) : undefined,
          author: row.author ? String(row.author) : undefined,
        };
        savedMap.set(rawItem.id, rawItem);
      }

      // 按保存顺序构建返回数据
      for (const saved of savedItemRecords) {
        const rawItem = savedMap.get(saved.itemId);
        if (rawItem) {
          const scoreInfo = calculateItemScores(rawItem, {
            now: new Date().toISOString(),
          });
          savedForLater.push(toBriefItem(rawItem, scoreInfo));
        }
      }
    }

    // 计算保留统计
    const keptItems = 1 + leadStories.length + topSignals.length;
    const retentionRate = totalItems > 0 ? Math.round((keptItems / totalItems) * 100) / 100 : 0;

    const response: DailyBriefData = {
      coverStory,
      leadStories,
      topSignals,
      scanBrief,
      savedForLater,
      meta: {
        generatedAt: new Date().toISOString(),
        totalItems,
        keptItems,
        retentionRate,
      },
    };

    return c.json({
      success: true,
      data: response,
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    });
  } finally {
    db.close();
  }
});

/**
 * GET /api/views/weekly-review - 获取周报视图
 *
 * 返回 7 天窗口的内容汇总：
 * - overview: 总内容数、保留数、保留率
 * - topics: 主题聚合（3-5 个主题）
 * - editorPicks: 用户保存的内容
 * - itemsByDate: 按日期分组的内容
 */
app.get("/weekly-review", async (c) => {
  const startTime = Date.now();
  const db = createDb("data/archive.db");

  try {
    // 获取 window 参数（默认 7 天）
    const windowParam = c.req.query("window");
    const windowDays = windowParam ? parseInt(windowParam, 10) : 7;

    // 构建周报视图
    const viewModel = await buildWeeklyReview({ db, windowDays });

    // 格式化 itemsByDate 为普通对象
    const itemsByDate: Record<string, Array<{ id: string; title: string; url: string; publishedAt?: string }>> = {};
    for (const [date, items] of viewModel.itemsByDate) {
      itemsByDate[date] = items;
    }

    const response = {
      overview: viewModel.overview,
      topics: viewModel.topics,
      editorPicks: viewModel.editorPicks,
      itemsByDate,
    };

    return c.json({
      success: true,
      data: response,
      meta: {
        timing: {
          generatedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
        },
      },
    });
  } finally {
    db.close();
  }
});

export { app as viewsRoute };
