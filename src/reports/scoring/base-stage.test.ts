import { describe, expect, test } from "bun:test";
import type { ReportCandidate } from "../../types/index";
import { applyBaseStage } from "./base-stage";

describe("applyBaseStage", () => {
  const createCandidate = (kind: "article" | "tweet"): ReportCandidate => ({
    id: `${kind}-1`,
    kind,
    packId: "pack-1",
    title: "Test",
    summary: "Summary",
    content: "",
    publishedAt: "2026-03-27T10:00:00Z",
    sourceLabel: "Source",
    normalizedUrl: "https://example.com/test",
    normalizedTitle: "test",
    rawRef: { id: `${kind}-1`, sourceId: "source-1" },
  });

  test("article with default kind preferences", () => {
    const candidate = createCandidate("article");
    const result = applyBaseStage({ candidate, kindPreferences: {} });
    // Default base score is 5 for articles when no preference set
    expect(result.baseScore).toBe(5);
  });

  test("tweet with default kind preferences", () => {
    const candidate = createCandidate("tweet");
    const result = applyBaseStage({ candidate, kindPreferences: {} });
    // Default base score is 10 for tweets when no preference set
    expect(result.baseScore).toBe(10);
  });

  test("article with undefined kindPreferences falls back to default", () => {
    const candidate = createCandidate("article");
    const result = applyBaseStage({ candidate, kindPreferences: undefined });
    expect(result.baseScore).toBe(5);
  });

  test("tweet with undefined kindPreferences falls back to default", () => {
    const candidate = createCandidate("tweet");
    const result = applyBaseStage({ candidate, kindPreferences: undefined });
    expect(result.baseScore).toBe(10);
  });

  test("article with explicit article preference", () => {
    const candidate = createCandidate("article");
    const result = applyBaseStage({ candidate, kindPreferences: { articles: 20 } });
    expect(result.baseScore).toBe(20);
  });

  test("tweet with explicit tweet preference", () => {
    const candidate = createCandidate("tweet");
    const result = applyBaseStage({ candidate, kindPreferences: { tweets: 15 } });
    expect(result.baseScore).toBe(15);
  });

  test("tweet with higher tweet preference", () => {
    const candidate = createCandidate("tweet");
    const result = applyBaseStage({
      candidate,
      kindPreferences: { articles: 10, tweets: 25 },
    });
    expect(result.baseScore).toBe(25);
  });

  test("article with higher tweet preference still uses article preference", () => {
    const candidate = createCandidate("article");
    const result = applyBaseStage({
      candidate,
      kindPreferences: { articles: 5, tweets: 25 },
    });
    expect(result.baseScore).toBe(5);
  });

  test("mixed preferences - tweet candidate uses tweets preference", () => {
    const tweet = createCandidate("tweet");
    const result = applyBaseStage({ candidate: tweet, kindPreferences: { articles: 20, tweets: 15 } });
    expect(result.baseScore).toBe(15);
  });
});