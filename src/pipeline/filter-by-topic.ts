import type { FilterContext, Topic } from "../types/index";

export interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  sourceKind?: string;
  engagementScore?: number | null;
  qualityScore?: number | null;
  /**
   * Topic IDs from the source's defaultTopicIds.
   * Only topics in this list are considered during classification.
   * If empty, the item is not classified into any topic.
   */
  sourceDefaultTopicIds?: string[];
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
 * Only considers topics that are in the item's sourceDefaultTopicIds and are enabled.
 */
export function filterByTopics(items: FilterableItem[], topics: Topic[]): FilterableItem[] {
  if (topics.length === 0) {
    return items;
  }

  // Skip disabled topics
  const enabledTopics = topics.filter((t) => t.enabled !== false);
  if (enabledTopics.length === 0) {
    return items;
  }

  const topicMap = new Map(enabledTopics.map((t) => [t.id, t]));

  return items.filter((item) => {
    const candidateTopics = getCandidateTopics(item, topicMap);
    return candidateTopics.some((topic) => classifyByTopic(item, topic));
  });
}

/**
 * Get candidate topics for an item based on its sourceDefaultTopicIds.
 * If sourceDefaultTopicIds is empty/undefined, returns an empty array (no topics).
 */
function getCandidateTopics(item: FilterableItem, topicMap: Map<string, Topic>): Topic[] {
  const defaultIds = item.sourceDefaultTopicIds;
  if (!defaultIds || defaultIds.length === 0) {
    return [];
  }
  const candidates: Topic[] = [];
  for (const id of defaultIds) {
    const topic = topicMap.get(id);
    if (topic) {
      candidates.push(topic);
    }
  }
  return candidates;
}

/**
 * Classify an item against all eligible topics (based on sourceDefaultTopicIds)
 * and return matched topic IDs.
 * Returns an array of topic IDs that the item qualifies for.
 */
export function classifyItemTopics(item: FilterableItem, topics: Topic[]): string[] {
  if (topics.length === 0) {
    return [];
  }

  // Skip disabled topics
  const enabledTopics = topics.filter((t) => t.enabled !== false);
  if (enabledTopics.length === 0) {
    return [];
  }

  const topicMap = new Map(enabledTopics.map((t) => [t.id, t]));
  const candidateTopics = getCandidateTopics(item, topicMap);

  return candidateTopics
    .filter((topic) => classifyByTopic(item, topic))
    .map((topic) => topic.id);
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
 * Score item against eligible topics (based on sourceDefaultTopicIds) and return topic match scores.
 * Returns Record<topicId, baseMatchScore> for topicScoresJson.
 * Only scores topics that are in the item's sourceDefaultTopicIds.
 */
export function scoreItemByTopic(
  item: FilterableItem,
  topics: Topic[]
): Record<string, number> {
  const scores: Record<string, number> = {};

  // Skip disabled topics
  const enabledTopics = topics.filter((t) => t.enabled !== false);

  // Only score topics within sourceDefaultTopicIds
  const defaultIds = item.sourceDefaultTopicIds;
  if (!defaultIds || defaultIds.length === 0) {
    return scores;
  }

  const defaultIdSet = new Set(defaultIds);
  const eligibleTopics = enabledTopics.filter((t) => defaultIdSet.has(t.id));

  for (const topic of eligibleTopics) {
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
