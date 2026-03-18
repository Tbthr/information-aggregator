/**
 * Engagement 评分模块
 * 统一的 engagement 评分计算函数
 */

import { parseRawItemMetadata } from "../utils/metadata";

/**
 * 计算 engagement 评分（有界 0-1）
 *
 * 公式：log10(score + comments * 0.5 + 1) / 2
 * - score: 点赞/like 数
 * - comments: 评论数，权重 0.5
 *
 * 特点：
 * - 对数衰减：高互动内容的边际收益递减
 * - 有界输出：最大值为 1
 * - 零值安全：无互动时返回 0
 */
export function toBoundedEngagementScore(metadataJson: string): number {
  const metadata = parseRawItemMetadata(metadataJson);
  const score = metadata?.engagement?.score ?? 0;
  const comments = metadata?.engagement?.comments ?? 0;
  const total = Math.max(0, score) + Math.max(0, comments * 0.5);
  return Math.min(1, Math.log10(total + 1) / 2);
}
