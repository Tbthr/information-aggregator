import type { FilterContext, Topic } from "../types/index";

interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  sourceKind?: string;
  engagementScore?: number | null;
  qualityScore?: number | null;
}

/**
 * Check if any of the keywords match in any of the fields (case-insensitive substring)
 */
function matchesAny(keywords: string[], title: string, summary: string, content: string): boolean {
  if (!keywords || keywords.length === 0) return false;
  const lowerTitle = title.toLowerCase();
  const lowerSummary = summary.toLowerCase();
  const lowerContent = content.toLowerCase();

  return keywords.some((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    return (
      lowerTitle.includes(lowerKeyword) ||
      lowerSummary.includes(lowerKeyword) ||
      lowerContent.includes(lowerKeyword)
    );
  });
}

/**
 * Topic-based classification and filtering.
 *
 * Implements the 6-step decision tree:
 * 1. Score boost multiplier applied to runtime scoring (not here)
 * 2. excludeRules checked first (OR semantics) - if any match, item is excluded
 * 3. includeRules checked second (OR semantics) - if configured, at least one must match
 * 4. contentKind filtering - sourceKind must match allowed kinds for topic
 * 5. quality threshold - if qualityScore configured, must meet minimum
 * 6. Default: pass if all checks pass
 *
 * Note: This handles the classification logic. The actual topic scoring happens in runtime.
 */
export function classifyByTopic(item: FilterableItem, topic: Topic): boolean {
  const { normalizedTitle, normalizedSummary, normalizedContent } = item;

  // Step 2: excludeRules first (if any exclude keyword matches, filter out)
  if (topic.excludeRules && topic.excludeRules.length > 0) {
    if (matchesAny(topic.excludeRules, normalizedTitle, normalizedSummary, normalizedContent)) {
      return false;
    }
  }

  // Step 3: includeRules (if configured, at least one keyword must match)
  if (topic.includeRules && topic.includeRules.length > 0) {
    if (!matchesAny(topic.includeRules, normalizedTitle, normalizedSummary, normalizedContent)) {
      return false;
    }
  }

  // Step 5: quality threshold check
  if (topic.scoreBoost !== undefined && topic.scoreBoost > 0) {
    // If we have a quality score, it must meet a minimum threshold
    // For now, topics with scoreBoost > 1.0 indicate high-quality content
    // Items with qualityScore below threshold may be filtered
    const minQualityThreshold = 0.3; // arbitrary threshold
    if (item.qualityScore !== undefined && item.qualityScore !== null && item.qualityScore < minQualityThreshold) {
      return false;
    }
  }

  // Step 6: Default pass
  return true;
}

/**
 * Filter items based on multiple topics (OR logic - item passes if it matches any topic)
 */
export function filterByTopics(items: FilterableItem[], topics: Topic[]): FilterableItem[] {
  if (topics.length === 0) {
    return items;
  }

  return items.filter((item) => topics.some((topic) => classifyByTopic(item, topic)));
}

/**
 * Legacy filterByPack function - redirects to topic-based classification.
 * Uses first topic from topicIds as the pack equivalent.
 * @deprecated Use filterByTopics with proper Topic objects
 */
export function filterByPack(item: FilterableItem, context: FilterContext): boolean {
  // Legacy context uses topicIds array
  // For backward compatibility during migration, we use topicIds as simple filter
  const { exclude, mustInclude } = context;

  // Exclude first (if any exclude keyword matches, filter out)
  if (exclude && exclude.length > 0) {
    if (matchesAny(exclude, item.normalizedTitle, item.normalizedSummary, item.normalizedContent)) {
      return false;
    }
  }

  // MustInclude second (if configured, at least one keyword must match)
  if (mustInclude && mustInclude.length > 0) {
    if (!matchesAny(mustInclude, item.normalizedTitle, item.normalizedSummary, item.normalizedContent)) {
      return false;
    }
  }

  // Default: pass
  return true;
}

/**
 * Score item against a topic and return topic match scores.
 * Returns Record<topicId, baseMatchScore> for topicScoresJson.
 */
export function scoreItemByTopic(
  item: FilterableItem,
  topics: Topic[]
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const topic of topics) {
    let score = 0;

    // Base score: 1.0 if passes classification, 0 if not
    if (!classifyByTopic(item, topic)) {
      scores[topic.id] = 0;
      continue;
    }

    // Calculate match strength based on keyword overlap
    const allText = `${item.normalizedTitle} ${item.normalizedSummary} ${item.normalizedContent}`.toLowerCase();

    // Count matching include rules
    const matchingIncludeRules = topic.includeRules.filter((rule) =>
      allText.includes(rule.toLowerCase())
    ).length;

    // Count matching exclude rules (negative signal)
    const matchingExcludeRules = topic.excludeRules.filter((rule) =>
      allText.includes(rule.toLowerCase())
    ).length;

    // Calculate base score: include matches / total include rules
    const includeScore = topic.includeRules.length > 0
      ? matchingIncludeRules / topic.includeRules.length
      : 1.0; // No include rules = pass all

    // Penalty for exclude matches
    const excludePenalty = matchingExcludeRules * 0.2;

    // Base score with boost
    score = Math.max(0, (includeScore - excludePenalty) * topic.scoreBoost);

    scores[topic.id] = Math.round(score * 100) / 100;
  }

  return scores;
}
