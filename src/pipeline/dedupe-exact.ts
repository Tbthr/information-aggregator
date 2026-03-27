interface ExactDedupItem {
  id: string;
  normalizedUrl: string;
  publishedAt?: string;
}

/**
 * Exact deduplication by normalizedUrl.
 * Groups items by normalizedUrl and keeps only the one with newest publishedAt.
 * "identity irrelevant" - we don't care about contentType or any other field.
 */
export function dedupeExact<T extends ExactDedupItem>(items: T[]): T[] {
  const winners = new Map<string, T>();

  for (const item of items) {
    const current = winners.get(item.normalizedUrl);

    if (!current) {
      // First occurrence - keep it
      winners.set(item.normalizedUrl, item);
    } else {
      // Compare publishedAt - keep newest
      const currentTime = current.publishedAt ? new Date(current.publishedAt).getTime() : 0;
      const itemTime = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;

      if (itemTime >= currentTime) {
        winners.set(item.normalizedUrl, item);
      }
      // If itemTime < currentTime, keep current (do nothing)
    }
  }

  return [...winners.values()];
}
