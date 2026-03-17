import { describe, expect, test } from "bun:test";
import type { PolicyMode, PackPolicy, SourcePolicy } from "./policy";

describe("policy types", () => {
  describe("PolicyMode", () => {
    test("accepts valid mode 'assist_only'", () => {
      const mode: PolicyMode = "assist_only";
      expect(mode).toBe("assist_only");
    });

    test("accepts valid mode 'filter_then_assist'", () => {
      const mode: PolicyMode = "filter_then_assist";
      expect(mode).toBe("filter_then_assist");
    });

    test("valid modes are exhaustive", () => {
      const modes: PolicyMode[] = ["assist_only", "filter_then_assist"];
      expect(modes).toHaveLength(2);
    });
  });

  describe("PackPolicy", () => {
    test("requires mode field", () => {
      const policy: PackPolicy = {
        mode: "assist_only",
      };
      expect(policy.mode).toBe("assist_only");
    });

    test("supports optional filterPrompt", () => {
      const policy: PackPolicy = {
        mode: "filter_then_assist",
        filterPrompt: "筛选技术相关内容",
      };
      expect(policy.filterPrompt).toBe("筛选技术相关内容");
    });

    test("filterPrompt is optional", () => {
      const policy: PackPolicy = {
        mode: "assist_only",
      };
      expect(policy.filterPrompt).toBeUndefined();
    });
  });

  describe("SourcePolicy", () => {
    test("extends PackPolicy with inheritedFrom", () => {
      const policy: SourcePolicy = {
        mode: "filter_then_assist",
        filterPrompt: "AI 相关",
        inheritedFrom: "pack-default",
      };
      expect(policy.inheritedFrom).toBe("pack-default");
      expect(policy.mode).toBe("filter_then_assist");
    });

    test("inheritedFrom is optional", () => {
      const policy: SourcePolicy = {
        mode: "assist_only",
      };
      expect(policy.inheritedFrom).toBeUndefined();
    });

    test("works without filterPrompt", () => {
      const policy: SourcePolicy = {
        mode: "assist_only",
        inheritedFrom: "parent-pack",
      };
      expect(policy.mode).toBe("assist_only");
      expect(policy.filterPrompt).toBeUndefined();
    });
  });
});
