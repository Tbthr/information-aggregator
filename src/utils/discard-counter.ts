import type { Logger } from '../utils/logger.js';

export interface DiscardCounters {
  noTimestamp: number;
  outsideWindow: number;
  invalidTimestamp: number;
}

export function createDiscardCounters(): DiscardCounters {
  return { noTimestamp: 0, outsideWindow: 0, invalidTimestamp: 0 };
}

export function logDiscardSummary(
  logger: Logger,
  sourceName: string,
  totalCollected: number,
  counters: DiscardCounters
): void {
  const total = counters.noTimestamp + counters.outsideWindow + counters.invalidTimestamp;
  logger.info(`[${sourceName}] 收集完成`, {
    stage: 'collect',
    total,
    totalCollected,
    ...counters,
  });
}
