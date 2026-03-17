/**
 * API 评分计算模块
 * 复用现有 pipeline 逻辑，为 API 响应计算分数
 */

import type { RawItem } from "../types/index";
import { parseRawItemMetadata } from "../utils/metadata";

/**
 * 分数详情接口
 */
export interface ScoreInfo {
  /** 最终分数 (0-10) */
  finalScore: number;
  /** 数据源权重分数 (0-1) */
  sourceWeight: number;
  /** 新鲜度分数 (0-1) */
  freshness: number;
  /** 互动分数 (0-1) */
  engagement: number;
  /** 内容质量分数 (0-1) */
  contentQuality: number;
}

/**
 * 计算选项
 */
export interface CalculateScoresOptions {
  /** 当前时间，默认为 new Date() */
  now?: string;
}

/**
 * 计算 engagementScore（复用 normalize.ts 逻辑）
 */
function toBoundedEngagementScore(metadataJson: string): number {
  const metadata = parseRawItemMetadata(metadataJson);
  const score = metadata?.engagement?.score ?? 0;
  const comments = metadata?.engagement?.comments ?? 0;
  const total = Math.max(0, score) + Math.max(0, comments * 0.5);
  return Math.min(1, Math.log10(total + 1) / 2);
}

/**
 * 计算新鲜度分数
 * 逻辑：越新分数越高
 * - 1小时内: 1.0
 * - 24小时内: 0.8-1.0 线性衰减
 * - 7天内: 0.5-0.8 线性衰减
 * - 更早: 0.1-0.5
 */
function calculateFreshnessScore(
  publishedAt: string | null | undefined,
  fetchedAt: string,
  now: string,
): number {
  const published = publishedAt ? Date.parse(publishedAt) : Date.parse(fetchedAt);
  const nowMs = Date.parse(now);

  if (isNaN(published) || isNaN(nowMs)) {
    return 0.5;
  }

  const ageMs = nowMs - published;
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 1) {
    return 1.0;
  } else if (ageHours <= 24) {
    // 24小时内: 1.0 -> 0.8 线性衰减
    return 1.0 - (ageHours / 24) * 0.2;
  } else if (ageHours <= 168) {
    // 7天内: 0.8 -> 0.5 线性衰减
    return 0.8 - ((ageHours - 24) / (168 - 24)) * 0.3;
  } else {
    // 更早: 0.5 -> 0.1，按周衰减
    const ageWeeks = ageHours / 168;
    return Math.max(0.1, 0.5 - ageWeeks * 0.05);
  }
}

/**
 * 计算单个内容项的分数
 */
export function calculateItemScores(
  item: RawItem,
  options: CalculateScoresOptions = {},
): ScoreInfo {
  const now = options.now ?? new Date().toISOString();

  // 1. engagementScore
  const engagement = toBoundedEngagementScore(item.metadataJson);

  // 2. freshnessScore
  const freshness = calculateFreshnessScore(item.publishedAt, item.fetchedAt, now);

  // 3. sourceWeightScore (固定为 1，后续可扩展)
  const sourceWeight = 1;

  // 4. contentQualityScore (默认 0.5，AI 可选)
  const contentQuality = 0.5;

  // 5. 计算最终分数（复用 rank.ts 公式）
  // 公式：sourceWeight 40% + freshness 35% + engagement 15% + contentQuality 10%
  const finalScore =
    sourceWeight * 0.4 +
    freshness * 0.35 +
    Math.min(1, engagement) * 0.15 +
    contentQuality * 0.1;

  return {
    finalScore: Math.round(finalScore * 10 * 10) / 10, // 保留一位小数，转换为 0-10 范围
    sourceWeight,
    freshness: Math.round(freshness * 100) / 100,
    engagement: Math.round(engagement * 100) / 100,
    contentQuality,
  };
}

/**
 * 批量计算分数
 */
export function calculateItemsScores(
  items: RawItem[],
  options: CalculateScoresOptions = {},
): Map<string, ScoreInfo> {
  const result = new Map<string, ScoreInfo>();
  for (const item of items) {
    result.set(item.id, calculateItemScores(item, options));
  }
  return result;
}
