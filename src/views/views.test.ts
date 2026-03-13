import { describe, expect, test } from "bun:test";

import type { QueryResult } from "../query/run-query";
import { buildViewModel, renderViewMarkdown } from "./registry";

const queryResult = {
  args: {
    packIds: ["ai-news"],
    viewId: "daily-brief",
    window: "24h",
  },
  selection: {
    packIds: ["ai-news"],
    viewId: "daily-brief",
    window: "24h",
    sources: [],
    keywords: ["ai", "news"],
  },
  items: [],
  normalizedItems: [],
  rankedItems: [
    {
      id: "item-1",
      title: "Fresh AI launch",
      url: "https://example.com/fresh",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 3.2,
    },
    {
      id: "item-2",
      title: "Second ranked item",
      url: "https://example.com/second",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 3.0,
    },
    {
      id: "item-3",
      title: "Third ranked item",
      url: "https://example.com/third",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 2.95,
    },
    {
      id: "item-4",
      title: "Thread sharing the launch",
      url: "https://x.com/example/status/2",
      linkedCanonicalUrl: "https://example.com/fresh",
      relationshipToCanonical: "share",
      sourceWeightScore: 1,
      freshnessScore: 1,
      engagementScore: 0.2,
      topicMatchScore: 1,
      contentQualityAi: 0,
      finalScore: 2.9,
    },
  ],
  clusters: [],
  warnings: [],
} satisfies QueryResult;

describe("views", () => {
  test("daily-brief builds articles list without AI client", async () => {
    // 无 AI client 时，视图仍能正常构建
    const model = await buildViewModel(queryResult, "daily-brief");
    const markdown = renderViewMarkdown(model, "daily-brief");

    // 验证基本结构
    expect(model.viewId).toBe("daily-brief");
    expect(model.title).toBe("Daily Brief");

    // 无 AI client 时，summary 和 highlights 为空
    expect(model.summary).toBe("");
    expect(model.highlights).toEqual([]);

    // 应该有 articles section
    expect(model.sections.map((section) => section.title)).toContain("Articles");
    const articlesSection = model.sections.find((s) => s.title === "Articles");
    expect(articlesSection?.items).toHaveLength(4);
    expect(articlesSection?.items[0]?.title).toBe("Fresh AI launch");

    // 验证 markdown 渲染
    expect(markdown).toContain("# Daily Digest");
    expect(markdown).toContain("Fresh AI launch");
  });

  test("daily-brief markdown contains expected sections", async () => {
    const model = await buildViewModel(queryResult, "daily-brief");
    const markdown = renderViewMarkdown(model, "daily-brief");

    // 验证 markdown 结构
    expect(markdown).toContain("# Daily Digest");
    expect(markdown).toContain("## 精选文章");
  });
});

// x-analysis 视图渲染测试
import { renderXAnalysisView } from "./render/x-analysis";
import type { XAnalysisViewModel } from "./x-analysis";

describe("x-analysis render", () => {
  test("renders fullText in ## 原文 section when present", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Test Post",
          url: "https://x.com/test/status/123",
          author: "testuser",
          summary: "AI summary content",
          tags: ["ai", "test"],
          fullText: "This is the full text of the post.\nWith multiple lines.",
        },
      ],
      tagCloud: ["ai", "test"],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    // 验证渲染顺序：标题 → 元数据 → AI 摘要 → 标签 → 分隔线 → 原文
    expect(markdown).toContain("### [Test Post](https://x.com/test/status/123)");
    expect(markdown).toContain("@testuser");
    expect(markdown).toContain("> AI summary content");
    expect(markdown).toContain("**标签**: `ai` `test`");
    expect(markdown).toContain("---");
    expect(markdown).toContain("## 原文");
    expect(markdown).toContain("This is the full text of the post.");
  });

  test("skips 原文 section when fullText is empty", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post Without Full Text",
          url: "https://x.com/test/status/456",
          summary: "Summary only",
          tags: [],
          fullText: "",
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).toContain("> Summary only");
    expect(markdown).not.toContain("## 原文");
  });

  test("skips 原文 section when fullText is whitespace only", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post With Whitespace",
          url: "https://x.com/test/status/789",
          summary: "Summary",
          tags: [],
          fullText: "   \n  \t  ",
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).toContain("> Summary");
    expect(markdown).not.toContain("## 原文");
  });

  test("renders engagement data", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Popular Post",
          url: "https://x.com/test/status/111",
          summary: "Popular",
          tags: [],
          engagement: {
            likes: 1500,
            retweets: 300,
            replies: 50,
          },
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).toContain("1.5K");  // likes
    expect(markdown).toContain("300");   // retweets
    expect(markdown).toContain("50");    // replies
  });

  test("renders images in ## 图片 section when media present", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post With Images",
          url: "https://x.com/test/status/222",
          summary: "Image post",
          tags: ["photo"],
          media: [
            { type: "photo", url: "https://example.com/image1.jpg" },
            { type: "photo", url: "https://example.com/image2.jpg" },
          ],
        },
      ],
      tagCloud: ["photo"],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).toContain("## 图片");
    expect(markdown).toContain("![](https://example.com/image1.jpg)");
    expect(markdown).toContain("![](https://example.com/image2.jpg)");
  });

  test("skips 图片 section when media is empty", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post Without Images",
          url: "https://x.com/test/status/333",
          summary: "Text only post",
          tags: [],
          media: [],
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).not.toContain("## 图片");
  });

  test("skips 图片 section when media is undefined", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post Without Media Field",
          url: "https://x.com/test/status/444",
          summary: "No media",
          tags: [],
          // media 未定义
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).not.toContain("## 图片");
  });

  // US-005: 渲染外链文章引用
  test("renders article in ## 外链 section when present", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post With Article",
          url: "https://x.com/test/status/555",
          summary: "Post with external link",
          tags: ["news"],
          article: {
            title: "External Article Title",
            url: "https://example.com/article",
          },
        },
      ],
      tagCloud: ["news"],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).toContain("## 外链");
    expect(markdown).toContain("[External Article Title](https://example.com/article)");
  });

  test("skips 外链 section when article is undefined", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post Without Article",
          url: "https://x.com/test/status/666",
          summary: "No external link",
          tags: [],
          // article 未定义
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).not.toContain("## 外链");
  });

  test("skips 外链 section when article.url is empty", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post With Empty Article URL",
          url: "https://x.com/test/status/777",
          summary: "Empty URL",
          tags: [],
          article: {
            title: "Article Without URL",
            url: "",
          },
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).not.toContain("## 外链");
  });

  // US-006: 渲染 Thread 长文
  test("renders thread in ## 长文 Thread section when present", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post With Thread",
          url: "https://x.com/test/status/888",
          summary: "Thread post",
          tags: ["thread"],
          thread: [
            { id: "1", text: "First tweet content", author: "user1" },
            { id: "2", text: "Second tweet content", author: "user2" },
          ],
        },
      ],
      tagCloud: ["thread"],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).toContain("## 长文 Thread");
    expect(markdown).toContain("**@user1**: First tweet content");
    expect(markdown).toContain("**@user2**: Second tweet content");
    // 验证分隔符在 thread 项之间
    expect(markdown).toContain("---");
  });

  test("shows **@未知作者** when thread item author is missing", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post With Thread Without Author",
          url: "https://x.com/test/status/999",
          summary: "Anonymous thread",
          tags: [],
          thread: [
            { id: "1", text: "Content without author" },
          ],
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).toContain("**@未知作者**: Content without author");
  });

  test("skips 长文 Thread section when thread is empty array", () => {
    const model: XAnalysisViewModel = {
      viewId: "x-analysis",
      title: "X 数据分析",
      posts: [
        {
          title: "Post With Empty Thread",
          url: "https://x.com/test/status/101",
          summary: "No thread",
          tags: [],
          thread: [],
        },
      ],
      tagCloud: [],
      sections: [],
    };

    const markdown = renderXAnalysisView(model);

    expect(markdown).not.toContain("## 长文 Thread");
  });
});
