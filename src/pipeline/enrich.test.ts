import { describe, expect, test } from "bun:test";

import { enrichCandidates } from "./enrich";
import type { RankedCandidate } from "../types/index";

describe("enrichCandidates", () => {
  describe("传统 AI 评分（向后兼容）", () => {
    test("runs enrichment only after candidate reduction", async () => {
      let scoreCalls = 0;

      const enriched = await enrichCandidates(
        [
          { id: "a", title: "A", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
          { id: "b", title: "B", normalizedTitle: "b", normalizedText: "b", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
          { id: "c", title: "C", normalizedTitle: "c", normalizedText: "c", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
        ],
        {
          limit: 2,
          scoreCandidate: async () => {
            scoreCalls += 1;
            return 0.8;
          },
        },
      );

      expect(scoreCalls).toBe(2);
      expect(enriched[0]?.contentQualityAi).toBe(0.8);
      expect(enriched[2]?.contentQualityAi).toBe(0);
    });

    test("没有 scoreCandidate 时不执行评分", async () => {
      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {});

      expect(enriched[0]?.contentQualityAi).toBe(0);
    });
  });

  describe("深度 Enrichment 配置", () => {
    test("禁用正文提取时不执行提取", async () => {
      const mockFetch = async () =>
        new Response("<html><body><p>Content</p></body></html>", { status: 200 });

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/a", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {
          enableContentExtraction: false,
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(enriched[0]?.extractedContent).toBeUndefined();
    });

    test("限制提取数量", async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        return new Response("<html><body><p>Content</p></body></html>", { status: 200 });
      };

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/a", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
        { id: "b", title: "B", url: "https://example.com/b", normalizedTitle: "b", normalizedText: "b", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
        { id: "c", title: "C", url: "https://example.com/c", normalizedTitle: "c", normalizedText: "c", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {
          contentExtractionLimit: 2,
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      // 只有前 2 个被提取
      expect(fetchCount).toBe(2);
      expect(enriched[0]?.extractedContent).toBeDefined();
      expect(enriched[1]?.extractedContent).toBeDefined();
      expect(enriched[2]?.extractedContent).toBeUndefined();
    });

    test("使用缓存避免重复提取", async () => {
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        return new Response("<html><body><p>Content</p></body></html>", { status: 200 });
      };

      const mockCache = {
        get: (key: string) => {
          if (key === "https://example.com/a") {
            return {
              url: "https://example.com/a",
              textContent: "Cached content",
              extractedAt: new Date().toISOString(),
            };
          }
          return null;
        },
        set: () => {},
        has: (key: string) => key === "https://example.com/a",
        delete: () => false,
        clear: () => {},
        size: () => 1,
        getStats: () => ({ size: 1, keys: ["https://example.com/a"] }),
        getBatch: () => new Map(),
        setBatch: () => {},
      };

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/a", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
        { id: "b", title: "B", url: "https://example.com/b", normalizedTitle: "b", normalizedText: "b", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {
          cacheEnabled: true,
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
        cache: mockCache as any,
      });

      // 只发起了一次请求（b 没有缓存）
      expect(fetchCount).toBe(1);
      expect(enriched[0]?.extractedContent?.textContent).toBe("Cached content");
      expect(enriched[1]?.extractedContent?.textContent).toBeDefined();
    });
  });

  describe("AI 增强", () => {
    test("AI Client 存在时执行增强", async () => {
      const mockAiClient = {
        scoreWithContent: async () => 8.5,
        extractKeyPoints: async () => ["Point 1", "Point 2"],
        generateTags: async () => ["tag1", "tag2"],
      };

      const mockFetch = async () =>
        new Response("<html><body><p>Content</p></body></html>", { status: 200 });

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/a", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {
          enableKeyPoints: true,
          enableTagging: true,
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
        aiClient: mockAiClient as any,
      });

      expect(enriched[0]?.aiEnrichment).toBeDefined();
      expect(enriched[0]?.aiEnrichment?.score).toBe(8.5);
      expect(enriched[0]?.aiEnrichment?.keyPoints).toEqual(["Point 1", "Point 2"]);
      expect(enriched[0]?.aiEnrichment?.tags).toEqual(["tag1", "tag2"]);
      // AI 评分应该覆盖原有评分
      expect(enriched[0]?.contentQualityAi).toBe(8.5);
    });

    test("禁用关键点提取时不执行", async () => {
      const mockAiClient = {
        scoreWithContent: async () => 7.0,
        extractKeyPoints: async () => ["Point 1"],
        generateTags: async () => ["tag1"],
      };

      const mockFetch = async () =>
        new Response("<html><body><p>Content</p></body></html>", { status: 200 });

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/a", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {
          enableKeyPoints: false,
          enableTagging: true,
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
        aiClient: mockAiClient as any,
      });

      expect(enriched[0]?.aiEnrichment?.keyPoints).toBeUndefined();
      expect(enriched[0]?.aiEnrichment?.tags).toBeDefined();
    });

    test("禁用标签生成时不执行", async () => {
      const mockAiClient = {
        scoreWithContent: async () => 7.0,
        extractKeyPoints: async () => ["Point 1"],
        generateTags: async () => ["tag1"],
      };

      const mockFetch = async () =>
        new Response("<html><body><p>Content</p></body></html>", { status: 200 });

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/a", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {
          enableKeyPoints: true,
          enableTagging: false,
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
        aiClient: mockAiClient as any,
      });

      expect(enriched[0]?.aiEnrichment?.keyPoints).toBeDefined();
      expect(enriched[0]?.aiEnrichment?.tags).toBeUndefined();
    });
  });

  describe("错误处理", () => {
    test("正文提取失败不影响其他候选项", async () => {
      let fetchCount = 0;
      const mockFetch = async (url: string) => {
        fetchCount++;
        if (url === "https://example.com/fail") {
          throw new Error("Network error");
        }
        return new Response("<html><body><p>Content</p></body></html>", { status: 200 });
      };

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/ok", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
        { id: "b", title: "B", url: "https://example.com/fail", normalizedTitle: "b", normalizedText: "b", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {},
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      // 两个请求都执行了
      expect(fetchCount).toBe(2);
      // 第一个成功
      expect(enriched[0]?.extractedContent?.textContent).toBeDefined();
      // 第二个有错误信息
      expect(enriched[1]?.extractedContent?.error).toBeDefined();
    });

    test("AI 增强失败不影响其他候选项", async () => {
      let aiCallCount = 0;
      const mockAiClient = {
        scoreWithContent: async () => {
          aiCallCount++;
          if (aiCallCount === 1) {
            throw new Error("AI error");
          }
          return 7.0;
        },
        extractKeyPoints: async () => [],
        generateTags: async () => [],
      };

      const mockFetch = async () =>
        new Response("<html><body><p>Content</p></body></html>", { status: 200 });

      const candidates: RankedCandidate[] = [
        { id: "a", title: "A", url: "https://example.com/a", normalizedTitle: "a", normalizedText: "a", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
        { id: "b", title: "B", url: "https://example.com/b", normalizedTitle: "b", normalizedText: "b", contentQualityAi: 0, sourceWeightScore: 1, freshnessScore: 1, engagementScore: 0 },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {},
        fetchImpl: mockFetch as unknown as typeof fetch,
        aiClient: mockAiClient as any,
      });

      // 两个都处理了
      expect(enriched[0]?.extractedContent).toBeDefined();
      expect(enriched[1]?.extractedContent).toBeDefined();
      // 第二个有 AI 增强结果（第一个失败）
      expect(enriched[1]?.aiEnrichment).toBeDefined();
    });
  });

  describe("社交帖子处理", () => {
    test("社交帖子跳过 URL 提取，直接使用已有内容", async () => {
      let fetchCalls = 0;
      const mockFetch = async () => {
        fetchCalls++;
        return new Response("<html><body><p>Error page</p></body></html>", { status: 500 });
      };

      const candidates: RankedCandidate[] = [
        {
          id: "x1",
          title: "X Post Title",
          url: "https://x.com/user/status/123",
          normalizedTitle: "X Post Title",
          normalizedText: "This is the full content of the X post from bird CLI, it should be long enough to pass validation checks.",
          contentType: "social_post",
          sourceType: "x-home",
          contentQualityAi: 0,
          sourceWeightScore: 1,
          freshnessScore: 1,
          engagementScore: 0,
        },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {},
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      // 不应该调用 fetch
      expect(fetchCalls).toBe(0);
      // 应该使用已有内容
      expect(enriched[0]?.extractedContent?.textContent).toContain("This is the full content of the X post");
      expect(enriched[0]?.extractedContent?.error).toBeUndefined();
    });

    test("sourceType 为 x_ 开头的帖子也跳过 URL 提取", async () => {
      let fetchCalls = 0;
      const mockFetch = async () => {
        fetchCalls++;
        return new Response("<html><body><p>Error</p></body></html>", { status: 500 });
      };

      const candidates: RankedCandidate[] = [
        {
          id: "x2",
          title: "X List Post",
          url: "https://x.com/user/status/456",
          normalizedTitle: "X List Post",
          normalizedText: "Content from X list timeline with enough characters to be valid for processing.",
          sourceType: "x-list",
          contentQualityAi: 0,
          sourceWeightScore: 1,
          freshnessScore: 1,
          engagementScore: 0,
        },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {},
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(fetchCalls).toBe(0);
      expect(enriched[0]?.extractedContent?.textContent).toContain("Content from X list timeline");
    });

    test("社交帖子可以进行 AI 增强", async () => {
      const mockAiClient = {
        scoreWithContent: async () => 8.5,
        extractKeyPoints: async () => ["Point 1", "Point 2"],
        generateTags: async () => ["tag1", "tag2"],
      };

      const candidates: RankedCandidate[] = [
        {
          id: "x3",
          title: "X Post with AI",
          url: "https://x.com/user/status/789",
          normalizedTitle: "X Post with AI",
          normalizedText: "This is a social post that should be processed by AI for enrichment and quality scoring purposes.",
          contentType: "social_post",
          contentQualityAi: 0,
          sourceWeightScore: 1,
          freshnessScore: 1,
          engagementScore: 0,
        },
      ];

      const enriched = await enrichCandidates(candidates, {
        enrichmentConfig: {},
        aiClient: mockAiClient as any,
      });

      expect(enriched[0]?.extractedContent?.textContent).toContain("This is a social post");
      expect(enriched[0]?.aiEnrichment?.score).toBe(8.5);
      expect(enriched[0]?.aiEnrichment?.keyPoints).toEqual(["Point 1", "Point 2"]);
      expect(enriched[0]?.aiEnrichment?.tags).toEqual(["tag1", "tag2"]);
    });
  });
});
