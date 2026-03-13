/**
 * 社交帖子相关工具函数
 * 用于判断和处理社交帖子类型的内容
 */

import type { RankedCandidate, ExtractedContent } from "../types/index";

/**
 * 判断是否为社交帖子类型（内容已在 snippet/normalizedText 中，无需 URL 提取）
 *
 * 判断规则：
 * 1. contentType 为 "social_post"
 * 2. sourceType 以 "x_" 开头（X/Twitter 系列）
 */
export function isSocialPost(item: RankedCandidate): boolean {
  if (item.contentType === "social_post") {
    return true;
  }
  if (item.sourceType?.startsWith("x_")) {
    return true;
  }
  return false;
}

/**
 * 为社交帖子构造 ExtractedContent（使用已有内容）
 *
 * 社交帖子的内容已经在 normalizedText 中，无需额外提取
 */
export function createSocialPostContent(candidate: RankedCandidate): ExtractedContent {
  const content = candidate.normalizedText ?? "";
  return {
    url: candidate.url ?? candidate.canonicalUrl ?? "",
    title: candidate.title ?? candidate.normalizedTitle,
    textContent: content,
    length: content.length,
    extractedAt: new Date().toISOString(),
  };
}
