import { describe, expect, test } from "bun:test";
import { normalizeAiFlashMarkers } from "./fetch-with-fallback";

describe("normalizeAiFlashMarkers", () => {
  test("归一化 jina 的 ** 和 []() 标记", () => {
    const input =
      "## **今日摘要**[]()\n内容\n## **AI资讯日报多渠道**[]()";
    const output = normalizeAiFlashMarkers(input);
    expect(output).toBe("## 今日摘要\n内容\n## AI资讯日报多渠道");
  });

  test("defuddle 输出原样通过", () => {
    const input = "## 今日摘要\n内容\n## AI资讯日报多渠道";
    expect(normalizeAiFlashMarkers(input)).toBe(input);
  });

  test("jina 无 []() 的格式也能处理", () => {
    const input =
      "## **今日摘要**\n内容\n## **AI资讯日报多渠道**";
    expect(normalizeAiFlashMarkers(input)).toBe(
      "## 今日摘要\n内容\n## AI资讯日报多渠道",
    );
  });

  test("混合输入正常处理", () => {
    const input =
      "## **今日摘要**[]()\n## 今日摘要\n## **AI资讯日报多渠道**[]()";
    const output = normalizeAiFlashMarkers(input);
    expect(output).toContain("## 今日摘要");
    expect(output).toContain("## AI资讯日报多渠道");
  });
});
