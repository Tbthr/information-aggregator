interface NearDedupItem {
  id: string;
  normalizedTitle: string;
  canonicalUrl: string;
  processedAt?: string;
}

function tokenize(value: string): Set<string> {
  return new Set(value.split(/\s+/).filter(Boolean));
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(a.size, b.size, 1);
}

function isWithinDay(left?: string, right?: string): boolean {
  if (!left || !right) {
    return true;
  }
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) <= 24 * 60 * 60 * 1000;
}

export function dedupeNear<T extends NearDedupItem>(items: T[], threshold = 0.74): T[] {
  const kept: T[] = [];

  for (const item of items) {
    const itemTokens = tokenize(item.normalizedTitle);
    const duplicate = kept.find((candidate) => {
      if (!isWithinDay(candidate.processedAt, item.processedAt)) {
        return false;
      }

      return overlapRatio(tokenize(candidate.normalizedTitle), itemTokens) >= threshold;
    });

    if (!duplicate) {
      kept.push(item);
    } else if ((item.processedAt ?? "") > (duplicate.processedAt ?? "")) {
      kept.splice(kept.indexOf(duplicate), 1, item);
    }
  }

  return kept;
}
