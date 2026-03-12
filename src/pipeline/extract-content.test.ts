import { describe, expect, test } from "bun:test";

import { extractArticleContent, isExtractionSuccess, getContentPreview, extractArticleContentBatch } from "./extract-content";

describe("extractArticleContent", () => {
  test("成功提取文章内容", async () => {
    // Mock fetch 返回简单的 HTML
    const mockFetch = async () =>
      new Response(
        `
        <html>
          <head><title>测试文章</title></head>
          <body>
            <article>
              <h1>文章标题</h1>
              <p>这是第一段内容。</p>
              <p>这是第二段内容，包含更多文字。</p>
            </article>
          </body>
        </html>
      `,
        { status: 200, headers: { "content-type": "text/html" } },
      );

    const result = await extractArticleContent("https://example.com/article", {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.error).toBeUndefined();
    expect(result.url).toBe("https://example.com/article");
    expect(result.title).toBeDefined();
    expect(result.textContent).toBeDefined();
    expect(result.textContent?.length).toBeGreaterThan(0);
    expect(result.length).toBeGreaterThan(0);
  });

  test("处理 HTTP 错误", async () => {
    const mockFetch = async () => new Response("Not Found", { status: 404 });

    const result = await extractArticleContent("https://example.com/notfound", {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain("404");
  });

  test("处理超时", async () => {
    const mockFetch = async () =>
      new Promise<Response>((resolve) => {
        setTimeout(() => resolve(new Response("<html></html>")), 100);
      });

    const result = await extractArticleContent("https://example.com/slow", {
      fetchImpl: mockFetch as unknown as typeof fetch,
      timeout: 10, // 10ms 超时
    });

    expect(result.error).toBeDefined();
  });

  test("限制内容长度", async () => {
    const longContent = "a".repeat(1000);
    const mockFetch = async () =>
      new Response(
        `
        <html>
          <body><article><p>${longContent}</p></article></body>
        </html>
      `,
        { status: 200 },
      );

    const result = await extractArticleContent("https://example.com/long", {
      fetchImpl: mockFetch as unknown as typeof fetch,
      maxLength: 100,
    });

    expect(result.textContent).toBeDefined();
    expect(result.textContent?.length).toBeLessThanOrEqual(103); // 100 + "..."
  });

  test("处理无效 HTML", async () => {
    const mockFetch = async () => new Response("Not HTML", { status: 200 });

    const result = await extractArticleContent("https://example.com/invalid", {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    // Readability 应该仍然返回一些内容
    expect(result.url).toBe("https://example.com/invalid");
    expect(result.extractedAt).toBeDefined();
  });
});

describe("isExtractionSuccess", () => {
  test("成功提取返回 true", () => {
    const content = {
      url: "https://example.com",
      extractedAt: new Date().toISOString(),
      textContent: "Some content",
    };
    expect(isExtractionSuccess(content)).toBe(true);
  });

  test("有错误时返回 false", () => {
    const content = {
      url: "https://example.com",
      extractedAt: new Date().toISOString(),
      error: "Failed to fetch",
    };
    expect(isExtractionSuccess(content)).toBe(false);
  });

  test("没有内容时返回 false", () => {
    const content = {
      url: "https://example.com",
      extractedAt: new Date().toISOString(),
    };
    expect(isExtractionSuccess(content)).toBe(false);
  });
});

describe("getContentPreview", () => {
  test("截断长内容", () => {
    const content = {
      url: "https://example.com",
      extractedAt: new Date().toISOString(),
      textContent: "a".repeat(300),
    };
    const preview = getContentPreview(content, 100);
    expect(preview.length).toBe(103); // 100 + "..."
  });

  test("短内容不截断", () => {
    const content = {
      url: "https://example.com",
      extractedAt: new Date().toISOString(),
      textContent: "Short content",
    };
    const preview = getContentPreview(content, 100);
    expect(preview).toBe("Short content");
  });

  test("有错误时显示错误", () => {
    const content = {
      url: "https://example.com",
      extractedAt: new Date().toISOString(),
      error: "Network error",
    };
    const preview = getContentPreview(content, 100);
    expect(preview).toContain("Network error");
  });
});

describe("extractArticleContentBatch", () => {
  test("批量提取多个 URL", async () => {
    const mockFetch = async (url: string) =>
      new Response(
        `
        <html>
          <body><article><p>Content from ${url}</p></article></body>
        </html>
      `,
        { status: 200 },
      );

    const urls = [
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/3",
    ];

    const results = await extractArticleContentBatch(urls, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(results).toHaveLength(3);
    expect(results[0]?.url).toBe("https://example.com/1");
    expect(results[1]?.url).toBe("https://example.com/2");
    expect(results[2]?.url).toBe("https://example.com/3");
  });

  test("单个失败不影响其他", async () => {
    let callCount = 0;
    const mockFetch = async (url: string) => {
      callCount++;
      if (url === "https://example.com/fail") {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("<html><body><p>OK</p></body></html>", { status: 200 });
    };

    const urls = [
      "https://example.com/ok1",
      "https://example.com/fail",
      "https://example.com/ok2",
    ];

    const results = await extractArticleContentBatch(urls, {
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(results).toHaveLength(3);
    expect(callCount).toBe(3); // 所有请求都执行了
    expect(results[0]?.error).toBeUndefined();
    expect(results[1]?.error).toBeDefined();
    expect(results[2]?.error).toBeUndefined();
  });
});
