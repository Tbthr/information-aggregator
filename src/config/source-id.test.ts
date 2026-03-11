import { describe, expect, test } from "bun:test";
import { generateSourceId } from "./source-id";

describe("generateSourceId", () => {
  test("generates id from simple URL", () => {
    expect(generateSourceId("https://openai.com/news/rss.xml")).toBe("openai-com-news-rss-xml");
  });

  test("generates id from URL with path", () => {
    expect(generateSourceId("https://huggingface.co/blog/feed.xml")).toBe("huggingface-co-blog-feed-xml");
  });

  test("generates id from root URL", () => {
    expect(generateSourceId("https://example.com/")).toBe("example-com");
  });

  test("normalizes special characters", () => {
    expect(generateSourceId("https://blog.example.com/posts/2024/article.html")).toBe("blog-example-com-posts-2024-article-html");
  });
});
