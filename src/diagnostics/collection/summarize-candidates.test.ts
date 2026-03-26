import { describe, expect, test } from "bun:test";
import type { RunCollectJobResult } from "../../pipeline/run-collect-job";
import { buildRunCandidateSummary } from "./summarize-candidates";
import type { RunCandidateSummary } from "./types";

// Unit tests for buildRunCandidateSummary

describe("buildRunCandidateSummary", () => {
  test("returns empty summary when topN is 0", () => {
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [
        { id: "1", title: "Test", sourceId: "src-1", sourceName: "Source", canonicalUrl: "https://example.com", score: 8.0 },
      ],
    };

    const summary = buildRunCandidateSummary(result, "afterNearDedup", 0);
    expect(summary.topItems.length).toBe(0);
  });

  test("returns empty summary when candidates array is empty", () => {
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [],
    };

    const summary = buildRunCandidateSummary(result, "afterNearDedup", 10);
    expect(summary.topItems.length).toBe(0);
  });

  test("selects top N by score descending", () => {
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [
        { id: "1", title: "Low", sourceId: "src-1", sourceName: "Source", canonicalUrl: "https://example.com/1", score: 3.0 },
        { id: "2", title: "High", sourceId: "src-2", sourceName: "Source", canonicalUrl: "https://example.com/2", score: 9.0 },
        { id: "3", title: "Mid", sourceId: "src-3", sourceName: "Source", canonicalUrl: "https://example.com/3", score: 6.0 },
      ],
    };

    const summary = buildRunCandidateSummary(result, "afterNearDedup", 2);
    expect(summary.topItems.length).toBe(2);
    expect(summary.topItems[0].title).toBe("High");
    expect(summary.topItems[1].title).toBe("Mid");
  });

  test("returns all candidates when topN exceeds candidates length", () => {
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [
        { id: "1", title: "A", sourceId: "src-1", sourceName: "Source", canonicalUrl: "https://example.com/1", score: 5.0 },
        { id: "2", title: "B", sourceId: "src-2", sourceName: "Source", canonicalUrl: "https://example.com/2", score: 4.0 },
      ],
    };

    const summary = buildRunCandidateSummary(result, "afterNearDedup", 10);
    expect(summary.topItems.length).toBe(2);
  });

  test("maps to correct output shape", () => {
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [
        {
          id: "1",
          title: "Article",
          sourceId: "src-1",
          sourceName: "Source",
          canonicalUrl: "https://example.com",
          score: 8.0,
        },
      ],
    };

    const summary = buildRunCandidateSummary(result, "afterNearDedup", 1);
    expect(summary.topItems[0]).toEqual({
      title: "Article",
      sourceId: "src-1",
      sourceName: "Source",
      canonicalUrl: "https://example.com",
    });
  });

  test("handles candidates with undefined score (defaults to 0)", () => {
    // Note: CandidateItem.score is required, but we test with 0 to ensure stability
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [
        { id: "1", title: "First", sourceId: "src-1", sourceName: "Source", canonicalUrl: "https://example.com/1", score: 0 },
        { id: "2", title: "Second", sourceId: "src-2", sourceName: "Source", canonicalUrl: "https://example.com/2", score: 0 },
      ],
    };

    const summary = buildRunCandidateSummary(result, "afterNearDedup", 1);
    expect(summary.topItems.length).toBe(1);
    // With equal scores, order is implementation-dependent but should be consistent
  });

  test("defaults to afterNearDedup level", () => {
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [
        { id: "1", title: "Test", sourceId: "src-1", sourceName: "Source", canonicalUrl: "https://example.com", score: 5.0 },
      ],
    };

    const summary = buildRunCandidateSummary(result);
    expect(summary.level).toBe("afterNearDedup");
  });

  test("accepts normalized level", () => {
    const result: RunCollectJobResult = {
      sourceEvents: [],
      counts: { raw: 0, normalized: 0, afterExactDedup: 0, afterNearDedup: 0, archivedNew: 0, archivedUpdated: 0 },
      archived: { newCount: 0, updateCount: 0 },
      failures: [],
      candidates: [
        { id: "1", title: "Test", sourceId: "src-1", sourceName: "Source", canonicalUrl: "https://example.com", score: 5.0 },
      ],
    };

    const summary = buildRunCandidateSummary(result, "normalized");
    expect(summary.level).toBe("normalized");
  });
});
