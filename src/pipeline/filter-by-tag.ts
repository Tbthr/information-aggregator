import type { Tag } from "../types/index";

export interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
  engagementScore?: number | null;
  /**
   * Tags from the source's tagFilter.
   * Use item.tagFilter directly (Tag[] from source).
   */
  tagFilter?: Tag[];
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
 * Tag-based classification.
 *
 * Implements the 4-step decision tree:
 * 1. excludeRules checked first (OR semantics) - if any match, item is excluded
 * 2. includeRules checked second (OR semantics) - if configured, at least one must match
 * 3. Default: pass if all checks pass
 */
export function classifyByTag(item: FilterableItem, tag: Tag): boolean {
  const { normalizedTitle, normalizedSummary, normalizedContent } = item;

  // Step 1: excludeRules first (if any exclude keyword matches, filter out)
  if (tag.excludeRules && tag.excludeRules.length > 0) {
    if (matchesAny(tag.excludeRules, normalizedTitle, normalizedSummary, normalizedContent)) {
      return false;
    }
  }

  // Step 2: includeRules (if configured, at least one keyword must match)
  if (tag.includeRules && tag.includeRules.length > 0) {
    if (!matchesAny(tag.includeRules, normalizedTitle, normalizedSummary, normalizedContent)) {
      return false;
    }
  }

  // Step 3: Default pass
  return true;
}

/**
 * Filter items based on multiple tags (OR logic - item passes if it matches any tag).
 * Uses item.tagFilter directly (Tag[] from source).
 */
export function filterByTags(items: FilterableItem[], tags: Tag[]): FilterableItem[] {
  if (tags.length === 0) {
    return items;
  }

  const tagMap = new Map(tags.map((t) => [t.id, t]));

  return items.filter((item) => {
    const itemTags = item.tagFilter ?? [];
    return itemTags.some((tag) => {
      const resolvedTag = tagMap.get(tag.id);
      if (!resolvedTag) return false;
      return classifyByTag(item, resolvedTag);
    });
  });
}
