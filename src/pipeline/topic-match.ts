import type { TopicRule } from "../types/index";

export interface TopicMatchItem {
  normalizedTitle?: string;
  normalizedText?: string;
  sourceId?: string;
}

export function scoreTopicMatch(item: TopicMatchItem, rule: TopicRule): number {
  const haystack = `${item.normalizedTitle ?? ""} ${item.normalizedText ?? ""}`;
  let score = 0;

  for (const keyword of rule.includeKeywords ?? []) {
    if (haystack.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }

  for (const keyword of rule.excludeKeywords ?? []) {
    if (haystack.includes(keyword.toLowerCase())) {
      score -= 2;
    }
  }

  if (item.sourceId && rule.preferredSources?.includes(item.sourceId)) {
    score += 0.5;
  }

  if (item.sourceId && rule.blockedSources?.includes(item.sourceId)) {
    score -= 5;
  }

  return score;
}
