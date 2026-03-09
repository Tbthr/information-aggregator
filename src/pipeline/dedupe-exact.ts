interface ExactDedupItem {
  id: string;
  exactDedupKey: string;
  processedAt?: string;
}

export function dedupeExact<T extends ExactDedupItem>(items: T[]): T[] {
  const winners = new Map<string, T>();

  for (const item of items) {
    const current = winners.get(item.exactDedupKey);
    // Latest processed item wins so downstream summaries prefer fresher metadata.
    if (!current || (item.processedAt ?? "") >= (current.processedAt ?? "")) {
      winners.set(item.exactDedupKey, item);
    }
  }

  return [...winners.values()];
}
