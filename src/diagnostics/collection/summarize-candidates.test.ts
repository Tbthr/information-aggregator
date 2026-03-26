import { describe, expect, test } from "bun:test";
import type { RunCandidateSummary, RunCandidateItem } from "./types";

// Unit tests for candidate summary building logic

describe("RunCandidateSummary type structure", () => {
  test("has correct shape with default level", () => {
    const summary: RunCandidateSummary = {
      level: "afterNearDedup",
      topItems: [
        {
          title: "Test Article",
          sourceId: "src-1",
          sourceName: "Test Source",
          canonicalUrl: "https://example.com/article",
        },
      ],
    };

    expect(summary.level).toBe("afterNearDedup");
    expect(summary.topItems.length).toBe(1);
    expect(summary.topItems[0].title).toBe("Test Article");
  });

  test("empty summary is valid", () => {
    const summary: RunCandidateSummary = {
      level: "afterNearDedup",
      topItems: [],
    };

    expect(summary.topItems.length).toBe(0);
  });

  test("all level variants are valid", () => {
    const levels: RunCandidateSummary["level"][] = ["normalized", "afterExactDedup", "afterNearDedup"];

    for (const level of levels) {
      const summary: RunCandidateSummary = { level, topItems: [] };
      expect(summary.level).toBe(level);
    }
  });
});

describe("RunCandidateItem type structure", () => {
  test("all fields optional except title and sourceId", () => {
    const item: RunCandidateItem = {
      title: "Article Title",
      sourceId: "src-1",
    };

    expect(item.title).toBe("Article Title");
    expect(item.sourceId).toBe("src-1");
    expect(item.sourceName).toBeUndefined();
    expect(item.canonicalUrl).toBeUndefined();
  });

  test("full item with all fields", () => {
    const item: RunCandidateItem = {
      title: "Full Article",
      sourceId: "src-1",
      sourceName: "Test Source",
      canonicalUrl: "https://example.com/full-article",
    };

    expect(item.sourceName).toBe("Test Source");
    expect(item.canonicalUrl).toBe("https://example.com/full-article");
  });
});

// Pure function tests for top-items selection
describe("candidate topItems selection logic", () => {
  type MockCandidate = {
    title: string;
    sourceId: string;
    sourceName?: string;
    canonicalUrl?: string;
    score: number;
  };

  function selectTopCandidates(candidates: MockCandidate[], topN: number): RunCandidateItem[] {
    if (topN <= 0) return [];

    return [...candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((c) => ({
        title: c.title,
        sourceId: c.sourceId,
        sourceName: c.sourceName,
        canonicalUrl: c.canonicalUrl,
      }));
  }

  test("selects top N by score", () => {
    const candidates: MockCandidate[] = [
      { title: "Low", sourceId: "src-1", score: 3.0 },
      { title: "High", sourceId: "src-2", score: 9.0 },
      { title: "Mid", sourceId: "src-3", score: 6.0 },
    ];

    const result = selectTopCandidates(candidates, 2);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe("High");
    expect(result[1].title).toBe("Mid");
  });

  test("returns all when topN exceeds candidates", () => {
    const candidates: MockCandidate[] = [
      { title: "A", sourceId: "src-1", score: 5.0 },
      { title: "B", sourceId: "src-2", score: 4.0 },
    ];

    const result = selectTopCandidates(candidates, 10);
    expect(result.length).toBe(2);
  });

  test("returns empty when candidates empty", () => {
    const result = selectTopCandidates([], 5);
    expect(result.length).toBe(0);
  });

  test("returns empty when topN is 0", () => {
    const candidates: MockCandidate[] = [
      { title: "A", sourceId: "src-1", score: 5.0 },
    ];

    const result = selectTopCandidates(candidates, 0);
    expect(result.length).toBe(0);
  });

  test("maps to correct output shape", () => {
    const candidates: MockCandidate[] = [
      {
        title: "Article",
        sourceId: "src-1",
        sourceName: "Source",
        canonicalUrl: "https://url.com",
        score: 8.0,
      },
    ];

    const result = selectTopCandidates(candidates, 1);
    expect(result[0]).toEqual({
      title: "Article",
      sourceId: "src-1",
      sourceName: "Source",
      canonicalUrl: "https://url.com",
    });
  });
});
