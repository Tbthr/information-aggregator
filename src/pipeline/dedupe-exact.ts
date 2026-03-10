interface ExactDedupItem {
  id: string;
  exactDedupKey: string;
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
    const current = winners.get(item.exactDedupKey);
    const currentPriority = contentTypePriority(current?.contentType);
    const itemPriority = contentTypePriority(item.contentType);

    if (
      !current
      || itemPriority > currentPriority
      || (itemPriority === currentPriority && (item.processedAt ?? "") >= (current.processedAt ?? ""))
    ) {
      winners.set(item.exactDedupKey, item);
    }
  }

  return [...winners.values()];
}
