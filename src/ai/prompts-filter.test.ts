import { describe, expect, test } from "bun:test";
import { buildFilterPrompt, type FilterItem, type PackContext } from "./prompts-filter";

describe("buildFilterPrompt", () => {
  const baseItem: FilterItem = {
    index: 0,
    title: "Test Title",
    summary: "Test content summary",
    url: "https://example.com/test",
  };

  const baseContext: PackContext = {
    name: "Test Pack",
    description: "关注 AI 前沿技术和产品动态",
  };

  test("生成包含结构化主题概述的 prompt", () => {
    const prompt = buildFilterPrompt([baseItem], baseContext);

    // 验证结构化部分存在
    expect(prompt).toContain("## Pack 主题概述");
    expect(prompt).toContain("- 名称: Test Pack");
    expect(prompt).toContain("- 主题说明: 关注 AI 前沿技术和产品动态");
  });

  test("生成包含判断标准的 prompt", () => {
    const prompt = buildFilterPrompt([baseItem], baseContext);

    // 验证判断标准部分存在
    expect(prompt).toContain("## 判断标准");
    expect(prompt).toContain("**应该保留**:");
    expect(prompt).toContain("**应该过滤**:");
  });

  test("无 description 时省略主题说明", () => {
    const context: PackContext = {
      name: "Test Pack",
    };

    const prompt = buildFilterPrompt([baseItem], context);

    expect(prompt).toContain("- 名称: Test Pack");
    expect(prompt).not.toContain("- 主题说明:");
  });

  test("截断过长的 summary", () => {
    const longSummary = "a".repeat(500);
    const item: FilterItem = {
      ...baseItem,
      summary: longSummary,
    };

    const prompt = buildFilterPrompt([item], baseContext);

    expect(prompt).toContain("a...");  // 应该被截断并添加省略号
    expect(prompt).not.toContain(longSummary);
  });

  test("限制最多 20 个条目", () => {
    const items: FilterItem[] = Array.from({ length: 25 }, (_, i) => ({
      ...baseItem,
      index: i,
      title: `Title ${i}`,
    }));

    const prompt = buildFilterPrompt(items, baseContext);

    // 只包含前 20 个条目
    expect(prompt).toContain("[0] 标题: Title 0");
    expect(prompt).toContain("[19] 标题: Title 19");
    expect(prompt).not.toContain("[20] 标题: Title 20");
    expect(prompt).not.toContain("[24] 标题: Title 24");
  });

  test("包含 JSON 格式说明", () => {
    const prompt = buildFilterPrompt([baseItem], baseContext);

    expect(prompt).toContain('"judgments"');
    expect(prompt).toContain('"index"');
    expect(prompt).toContain('"keep"');
    expect(prompt).toContain('"reason"');
  });
});
