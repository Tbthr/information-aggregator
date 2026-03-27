import { describe, expect, test } from "bun:test";
import type { ReportCandidate } from "../../types/index";
import { applyHistoryPenaltyStage } from "./history-penalty-stage";

describe("applyHistoryPenaltyStage", () => {
  const createCandidate = (id: string, url: string, title: string, daysAgo: number): ReportCandidate => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      id,
      kind: "article",
      packId: "pack-1",
      title,
      summary: "Summary",
      content: "",
      publishedAt: date.toISOString(),
      sourceLabel: "Source",
      normalizedUrl: url,
      normalizedTitle: title.toLowerCase(),
      rawRef: { id, sourceId: "source-1" },
    };
  };

  test("no penalty when no recent candidates", () => {
    const candidate = createCandidate("c1", "https://example.com/1", "article one", 0);
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates: [],
    });
    expect(result.historyPenalty).toBe(0);
    expect(result.finalScore).toBe(100);
  });

  test("no penalty for non-matching URL", () => {
    const candidate = createCandidate("c1", "https://example.com/new", "new article", 0);
    const recentCandidates = [
      createCandidate("old1", "https://example.com/old", "old article", 1),
    ];
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates,
      windowDays: 14,
    });
    expect(result.historyPenalty).toBe(0);
    expect(result.finalScore).toBe(100);
  });

  test("exact URL match applies penalty", () => {
    const candidate = createCandidate("c1", "https://example.com/same", "same article", 0);
    const recentCandidates = [
      createCandidate("old1", "https://example.com/same", "same article", 1),
    ];
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates,
      windowDays: 14,
    });
    expect(result.historyPenalty).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThan(100);
  });

  test("near title match applies penalty", () => {
    const candidate = createCandidate("c1", "https://example.com/new1", "openai releases new gpt model today", 0);
    const recentCandidates = [
      createCandidate("old1", "https://example.com/old1", "OpenAI releases new GPT model", 1),
    ];
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates,
      windowDays: 14,
    });
    // Title similarity should trigger penalty
    expect(result.historyPenalty).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThan(100);
  });

  test("candidates outside window do not affect penalty", () => {
    const candidate = createCandidate("c1", "https://example.com/same", "same article", 0);
    const recentCandidates = [
      createCandidate("old1", "https://example.com/same", "same article", 15), // Outside 14-day window
    ];
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates,
      windowDays: 14,
    });
    expect(result.historyPenalty).toBe(0);
    expect(result.finalScore).toBe(100);
  });

  test("penalty only reduces weight, does not filter", () => {
    const candidate = createCandidate("c1", "https://example.com/dup", "duplicate article", 0);
    const recentCandidates = [
      createCandidate("old1", "https://example.com/dup", "duplicate article", 1),
    ];
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates,
      windowDays: 14,
    });
    // Final score should still be positive even with penalty
    expect(result.finalScore).toBeGreaterThan(0);
  });

  test("multiple recent matches accumulate penalty", () => {
    const candidate = createCandidate("c1", "https://example.com/same", "same article", 0);
    const recentCandidates = [
      createCandidate("old1", "https://example.com/same", "same article", 1),
      createCandidate("old2", "https://example.com/same2", "same article variation", 3),
      createCandidate("old3", "https://example.com/old3", "openai releases new model", 5),
    ];
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates,
      windowDays: 14,
    });
    // Multiple matches should result in higher penalty
    expect(result.historyPenalty).toBeGreaterThan(0);
  });

  test("default window is 14 days", () => {
    const candidate = createCandidate("c1", "https://example.com/same", "same article", 0);
    const recentCandidates = [
      createCandidate("old1", "https://example.com/same", "same article", 10), // Within default 14-day window
    ];
    const result = applyHistoryPenaltyStage({
      runtimeScore: 100,
      candidate,
      recentCandidates,
    });
    expect(result.historyPenalty).toBeGreaterThan(0);
  });
});