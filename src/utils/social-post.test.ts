import { describe, test, expect } from "bun:test";
import { isSocialPost, createSocialPostContent } from "./social-post";
import type { RankedCandidate } from "../types/index";

describe("isSocialPost", () => {
  test("should return true for contentType 'social_post'", () => {
    const item = {
      id: "1",
      contentType: "social_post",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0,
      topicMatchScore: 0,
      contentQualityAi: 0,
    } as RankedCandidate;

    expect(isSocialPost(item)).toBe(true);
  });

  test("should return true for sourceType starting with 'x-'", () => {
    const sources = ["x-home", "x-list", "x-bookmarks", "x-likes"];

    sources.forEach((sourceType) => {
      const item = {
        id: "1",
        sourceType,
        sourceWeightScore: 1,
        freshnessScore: 1,
        engagementScore: 0,
        topicMatchScore: 0,
        contentQualityAi: 0,
      } as RankedCandidate;

      expect(isSocialPost(item)).toBe(true);
    });
  });

  test("should return false for non-social post types", () => {
    const item = {
      id: "1",
      contentType: "article",
      sourceType: "rss",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0,
      topicMatchScore: 0,
      contentQualityAi: 0,
    } as RankedCandidate;

    expect(isSocialPost(item)).toBe(false);
  });

  test("should return false when both contentType and sourceType are undefined", () => {
    const item = {
      id: "1",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0,
      topicMatchScore: 0,
      contentQualityAi: 0,
    } as RankedCandidate;

    expect(isSocialPost(item)).toBe(false);
  });
});

describe("createSocialPostContent", () => {
  test("should create ExtractedContent from social post", () => {
    const candidate = {
      id: "123",
      url: "https://x.com/user/status/123",
      title: "Test Post",
      normalizedTitle: "test post",
      normalizedText: "This is a test post content",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0,
      topicMatchScore: 0,
      contentQualityAi: 0,
    } as RankedCandidate;

    const result = createSocialPostContent(candidate);

    expect(result.url).toBe("https://x.com/user/status/123");
    expect(result.title).toBe("Test Post");
    expect(result.textContent).toBe("This is a test post content");
    expect(result.length).toBe(27);
    expect(result.extractedAt).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  test("should handle missing fields gracefully", () => {
    const candidate = {
      id: "456",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0,
      topicMatchScore: 0,
      contentQualityAi: 0,
    } as RankedCandidate;

    const result = createSocialPostContent(candidate);

    expect(result.url).toBe("");
    expect(result.title).toBeUndefined();
    expect(result.textContent).toBe("");
    expect(result.length).toBe(0);
  });

  test("should use canonicalUrl as fallback", () => {
    const candidate = {
      id: "789",
      canonicalUrl: "https://x.com/user/status/789",
      normalizedText: "Content",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0,
      topicMatchScore: 0,
      contentQualityAi: 0,
    } as RankedCandidate;

    const result = createSocialPostContent(candidate);

    expect(result.url).toBe("https://x.com/user/status/789");
  });
});
