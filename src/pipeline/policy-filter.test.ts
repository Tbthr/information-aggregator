import { describe, expect, test } from "bun:test";
import { policyFilterCandidates, type PolicyFilterConfig } from "./policy-filter";
import type { RankedCandidate, SourcePack } from "../types/index";
import type { SourcePolicy } from "../types/policy";
import type { AiClient } from "../ai/types";
import type { FilterJudgment } from "../types/ai-response";
import type { FilterItem, PackContext } from "../ai/prompts-filter";

// Mock 数据工厂
function createMockCandidate(overrides: Partial<RankedCandidate> = {}): RankedCandidate {
  return {
    id: "test-id",
    sourceId: "source-1",
    title: "Test Title",
    normalizedTitle: "Test Title",
    normalizedText: "Test content snippet",
    url: "https://example.com/test",
    canonicalUrl: "https://example.com/test",
    sourceWeightScore: 0.5,
    freshnessScore: 0.8,
    engagementScore: 0.3,
    topicMatchScore: 0.7,
    contentQualityAi: 0.6,
    ...overrides,
  };
}

function createMockPack(overrides: Partial<SourcePack> = {}): SourcePack {
  return {
    id: "pack-1",
    name: "Test Pack",
    description: "Test pack description",
    keywords: ["test", "example"],
    sources: [],
    ...overrides,
  };
}

// Mock AI 客户端
function createMockAiClient(
  filterBehavior: (items: FilterItem[], packContext: PackContext) => FilterJudgment[]
): AiClient {
  return {
    scoreCandidate: async () => 0.5,
    summarizeCluster: async () => "summary",
    narrateDigest: async () => "narrative",
    suggestTopics: async () => [],
    summarizeItem: async () => "summary",
    scoreWithContent: async () => 0.5,
    extractKeyPoints: async () => [],
    generateTags: async () => [],
    summarizeContent: async () => "summary",
    scoreMultiDimensional: async () => null,
    generateHighlights: async () => null,
    enrichArticle: async () => null,
    generateDailyBriefOverview: async () => null,
    summarizePost: async () => null,
    batchFilter: async (items: FilterItem[], packContext: PackContext) => filterBehavior(items, packContext),
  };
}

describe("policyFilterCandidates", () => {
  describe("assist_only 模式", () => {
    test("保留所有条目", async () => {
      const candidates = [
        createMockCandidate({ id: "1", sourceId: "source-1" }),
        createMockCandidate({ id: "2", sourceId: "source-1" }),
        createMockCandidate({ id: "3", sourceId: "source-1" }),
      ];

      const policyMap = new Map<string, SourcePolicy>([
        ["source-1", { mode: "assist_only" }],
      ]);

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap
      );

      expect(result.kept).toHaveLength(3);
      expect(result.filtered).toHaveLength(0);
      expect(result.stats.assistOnlyKept).toBe(3);
      expect(result.stats.totalInput).toBe(3);
    });

    test("多 source 分组时正确统计", async () => {
      const candidates = [
        createMockCandidate({ id: "1", sourceId: "source-assist" }),
        createMockCandidate({ id: "2", sourceId: "source-assist" }),
        createMockCandidate({ id: "3", sourceId: "source-no-policy" }),
      ];

      const policyMap = new Map<string, SourcePolicy>([
        ["source-assist", { mode: "assist_only" }],
      ]);

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap
      );

      expect(result.kept).toHaveLength(3);
      expect(result.filtered).toHaveLength(0);
      expect(result.stats.assistOnlyKept).toBe(2);
      expect(result.stats.noPolicyCount).toBe(1);
    });
  });

  describe("filter_then_assist 模式", () => {
    test("调用 AI 进行过滤", async () => {
      let aiCallCount = 0;

      const mockAiClient = createMockAiClient((items, _packContext) => {
        aiCallCount++;
        // 第一项保留，第二项过滤
        return items.map((item, idx) => ({
          keepDecision: idx === 0,
          keepReason: idx === 0 ? "相关" : "不相关",
          judgedAt: new Date().toISOString(),
        }));
      });

      const candidates = [
        createMockCandidate({ id: "1", sourceId: "source-filter" }),
        createMockCandidate({ id: "2", sourceId: "source-filter" }),
      ];

      const policyMap = new Map<string, SourcePolicy>([
        ["source-filter", { mode: "filter_then_assist" }],
      ]);

      const config: PolicyFilterConfig = { aiClient: mockAiClient };

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap,
        config
      );

      expect(aiCallCount).toBe(1);
      expect(result.kept).toHaveLength(1);
      expect(result.filtered).toHaveLength(1);
      expect(result.stats.filterThenAssistProcessed).toBe(2);
      expect(result.stats.filterThenAssistFiltered).toBe(1);
      expect(result.stats.aiCallCount).toBe(1);
    });

    test("AI 返回空数组时所有条目被过滤", async () => {
      const mockAiClient = createMockAiClient(() => []);

      const candidates = [
        createMockCandidate({ id: "1", sourceId: "source-filter" }),
      ];

      const policyMap = new Map<string, SourcePolicy>([
        ["source-filter", { mode: "filter_then_assist" }],
      ]);

      const config: PolicyFilterConfig = { aiClient: mockAiClient };

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap,
        config
      );

      expect(result.kept).toHaveLength(0);
      expect(result.filtered).toHaveLength(1);
    });

    test("AI 判断结果正确映射到候选条目", async () => {
      const mockAiClient = createMockAiClient((items) => {
        return items.map(() => ({
          keepDecision: true,
          keepReason: "高质量内容",
          readerBenefit: "提供有价值的技术见解",
          readingHint: "关注核心观点",
          judgedAt: "2024-01-01T00:00:00Z",
        }));
      });

      const candidates = [
        createMockCandidate({ id: "item-1", sourceId: "source-filter" }),
      ];

      const policyMap = new Map<string, SourcePolicy>([
        ["source-filter", { mode: "filter_then_assist" }],
      ]);

      const config: PolicyFilterConfig = { aiClient: mockAiClient };

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap,
        config
      );

      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].id).toBe("item-1");
    });
  });

  describe("AI 失败降级", () => {
    test("无 AI 客户端时 fallback 到 assist_only", async () => {
      const candidates = [
        createMockCandidate({ id: "1", sourceId: "source-filter" }),
        createMockCandidate({ id: "2", sourceId: "source-filter" }),
      ];

      const policyMap = new Map<string, SourcePolicy>([
        ["source-filter", { mode: "filter_then_assist" }],
      ]);

      // 不提供 aiClient
      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap,
        {}
      );

      // 无 AI 客户端时应保留所有条目
      expect(result.kept).toHaveLength(2);
      expect(result.filtered).toHaveLength(0);
    });

    test("AI 调用失败时 fallback 到 assist_only", async () => {
      const mockAiClient: AiClient = {
        scoreCandidate: async () => 0.5,
        summarizeCluster: async () => "summary",
        narrateDigest: async () => "narrative",
        suggestTopics: async () => [],
        summarizeItem: async () => "summary",
        scoreWithContent: async () => 0.5,
        extractKeyPoints: async () => [],
        generateTags: async () => [],
        summarizeContent: async () => "summary",
        scoreMultiDimensional: async () => null,
        generateHighlights: async () => null,
        enrichArticle: async () => null,
        generateDailyBriefOverview: async () => null,
        summarizePost: async () => null,
        batchFilter: async () => {
          throw new Error("AI 服务不可用");
        },
      };

      const candidates = [
        createMockCandidate({ id: "1", sourceId: "source-filter" }),
      ];

      const policyMap = new Map<string, SourcePolicy>([
        ["source-filter", { mode: "filter_then_assist" }],
      ]);

      const config: PolicyFilterConfig = { aiClient: mockAiClient };

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap,
        config
      );

      // AI 失败时应保留所有条目作为降级处理
      expect(result.kept).toHaveLength(1);
      expect(result.filtered).toHaveLength(0);
    });
  });

  describe("边界情况", () => {
    test("空输入返回空结果", async () => {
      const result = await policyFilterCandidates(
        [],
        createMockPack(),
        new Map()
      );

      expect(result.kept).toHaveLength(0);
      expect(result.filtered).toHaveLength(0);
      expect(result.stats.totalInput).toBe(0);
      expect(result.stats.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    test("无策略的条目全部保留", async () => {
      const candidates = [
        createMockCandidate({ id: "1", sourceId: "source-no-policy" }),
        createMockCandidate({ id: "2", sourceId: "source-no-policy" }),
      ];

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        new Map() // 空策略映射
      );

      expect(result.kept).toHaveLength(2);
      expect(result.filtered).toHaveLength(0);
      expect(result.stats.noPolicyCount).toBe(2);
    });

    test("批处理正确分割大批次", async () => {
      let batchCount = 0;

      const mockAiClient = createMockAiClient((items) => {
        batchCount++;
        return items.map(() => ({
          keepDecision: true,
          keepReason: "保留",
          judgedAt: new Date().toISOString(),
        }));
      });

      // 创建 25 个条目，batchSize 设为 10
      const candidates = Array.from({ length: 25 }, (_, i) =>
        createMockCandidate({ id: `item-${i}`, sourceId: "source-filter" })
      );

      const policyMap = new Map<string, SourcePolicy>([
        ["source-filter", { mode: "filter_then_assist" }],
      ]);

      const config: PolicyFilterConfig = {
        aiClient: mockAiClient,
        batchSize: 10,
      };

      const result = await policyFilterCandidates(
        candidates,
        createMockPack(),
        policyMap,
        config
      );

      // 25 个条目，batchSize 10，应该分 3 批
      expect(batchCount).toBe(3);
      expect(result.kept).toHaveLength(25);
      expect(result.stats.aiCallCount).toBe(3);
    });
  });
});
