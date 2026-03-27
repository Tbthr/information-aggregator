import type { FilterContext } from "../types/index";

interface FilterableItem {
  normalizedTitle: string;
  normalizedSummary: string;
  normalizedContent: string;
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
 * Filter items based on pack's mustInclude and exclude rules.
 * - exclude is checked first (OR semantics)
 * - mustInclude is checked second (OR semantics)
 * - Default: pass if mustInclude not configured
 */
export function filterByPack(item: FilterableItem, context: FilterContext): boolean {
  const { normalizedTitle, normalizedSummary, normalizedContent } = item;
  const { exclude, mustInclude } = context;

  // Exclude first (if any exclude keyword matches, filter out)
  if (exclude && exclude.length > 0) {
    if (matchesAny(exclude, normalizedTitle, normalizedSummary, normalizedContent)) {
      return false;
    }
  }

  // MustInclude second (if configured, at least one keyword must match)
  if (mustInclude && mustInclude.length > 0) {
    if (!matchesAny(mustInclude, normalizedTitle, normalizedSummary, normalizedContent)) {
      return false;
    }
  }

  // Default: pass
  return true;
}
