interface ExactDedupItem {
  id: string;
  normalizedUrl: string;
  processedAt?: string;
  contentType?: string;
}

function contentTypePriority(contentType?: string): number {
  switch (contentType) {
    case "article":
      return 3;
    case "digest_entry":
      return 2;
    case "community_post":
      return 1;
    default:
      return 0;
  }
}

export function dedupeExact<T extends ExactDedupItem>(items: T[]): T[] {
  const winners = new Map<string, T>();

  for (const item of items) {
    const current = winners.get(item.normalizedUrl);
    const currentPriority = contentTypePriority(current?.contentType);
    const itemPriority = contentTypePriority(item.contentType);

    if (
      !current
      || itemPriority > currentPriority
      || (itemPriority === currentPriority && (item.processedAt ?? "") >= (current.processedAt ?? ""))
    ) {
      winners.set(item.normalizedUrl, item);
    }
  }

  return [...winners.values()];
}
