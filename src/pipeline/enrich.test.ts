import { describe, expect, test } from "bun:test";

import { contentQuality, needsEnrichment } from "./enrich";

describe("contentQuality", () => {
  test("pass: >500 chars with 3+ sentences", () => {
    // Create text with >500 chars and 3+ sentences
    const text = "这是第一句话。这是第二句话。这是第三句话。".repeat(50);
    expect(text.length).toBeGreaterThan(500);
    const result = contentQuality(text);
    expect(result.status).toBe("pass");
  });

  test("fail: content too short (<500)", () => {
    const text = "这是第一句话。这是第二句话。"; // only ~12 chars
    expect(text.length).toBeLessThan(500);
    const result = contentQuality(text);
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("内容过短");
  });

  test("fail: less than 3 sentences", () => {
    // Create text >500 chars but only 1 sentence (use commas within sentence, 。 only at end)
    const base = "这是一句话，这句话很长，包含了超过500个字符的内容，所以我们需要确保文本长度真的超过500字符，这样才能测试到句子数不足的情况，这句话的内容是用逗号分隔的，所以它只是一个很长的句子，包含了很多的中文字符";
    const text = base.repeat(10) + "。";
    expect(text.length).toBeGreaterThan(500);
    const result = contentQuality(text);
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("句子数不足");
  });

  test("fail: contains truncation marker [...]", () => {
    // Create valid text >500 chars but with truncation marker
    const base = "这是第一句话。这是第二句话。这是第三句话。".repeat(50);
    const text = base + "[...]";
    expect(text.length).toBeGreaterThan(500);
    const result = contentQuality(text);
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("截断标记");
  });

  test("fail: contains 'Read more'", () => {
    // Create valid text >500 chars but with Read more
    const base = "这是第一句话。这是第二句话。这是第三句话。".repeat(50);
    const text = base + "Read more";
    expect(text.length).toBeGreaterThan(500);
    const result = contentQuality(text);
    expect(result.status).toBe("fail");
    expect(result.reason).toContain("截断标记");
  });

  test("pass: HTML tags stripped, counts plain text", () => {
    // HTML with 3+ sentences and >500 chars after stripping
    const html = "<p>这是第一句话。</p><div>这是第二句话。</div><span>这是第三句话。</span>".repeat(50);
    expect(html.replace(/<[^>]*>/g, "").trim().length).toBeGreaterThan(500);
    const result = contentQuality(html);
    expect(result.status).toBe("pass");
  });
});

describe("needsEnrichment", () => {
  const options = {
    batchSize: 10,
    minContentLength: 500,
    fetchTimeout: 20000,
  };

  test("needsEnrichment: quality sufficient → not needed", () => {
    const goodContent = "这是第一句话。这是第二句话。这是第三句话。".repeat(50);
    expect(goodContent.length).toBeGreaterThan(500);
    const result = needsEnrichment(goodContent, "https://example.com/article", options);
    expect(result.needed).toBe(false);
    expect(result.reason).toBe("内容质量达标");
  });

  test("needsEnrichment: quality insufficient + URL → needed", () => {
    const shortContent = "这是第一句话。"; // 不足500字符
    const result = needsEnrichment(shortContent, "https://example.com/article", options);
    expect(result.needed).toBe(true);
    // URL is available so enrichment is needed
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test("needsEnrichment: quality insufficient + no URL → not needed", () => {
    const shortContent = "这是第一句话。"; // 不足500字符
    const result = needsEnrichment(shortContent, undefined, options);
    expect(result.needed).toBe(false);
    expect(result.reason).toContain("无 URL 可供提取");
  });
});
