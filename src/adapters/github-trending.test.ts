import { describe, expect, test } from "bun:test";

import { collectGitHubTrendingSource, parseGitHubTrendingHtml } from "./github-trending";

describe("parseGitHubTrendingHtml", () => {
  describe("基本解析", () => {
    test("extracts repo url, name, description, and language", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/openai/information-aggregator"> openai / information-aggregator </a></h2>
          <p>Curated information aggregation.</p>
          <span itemprop="programmingLanguage">TypeScript</span>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");

      expect(items).toHaveLength(1);
      expect(items[0]?.url).toBe("https://github.com/openai/information-aggregator");
      expect(items[0]?.title).toBe("openai / information-aggregator");
      expect(items[0]?.snippet).toContain("TypeScript");
    });

    test("handles multiple articles", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/user/repo1"> user / repo1 </a></h2>
          <p>Description 1</p>
          <span itemprop="programmingLanguage">Python</span>
        </article>
        <article class="Box-row">
          <h2><a href="/user/repo2"> user / repo2 </a></h2>
          <p>Description 2</p>
          <span itemprop="programmingLanguage">JavaScript</span>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");

      expect(items).toHaveLength(2);
      expect(items[0]?.title).toBe("user / repo1");
      expect(items[1]?.title).toBe("user / repo2");
    });

    test("filters out articles with invalid urls", () => {
      const html = `
        <article class="Box-row">
          <h2><a> no href repo </a></h2>
        </article>
        <article class="Box-row">
          <h2><a href="/user/repo"> user / repo </a></h2>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");

      expect(items).toHaveLength(1);
      expect(items[0]?.url).toBe("https://github.com/user/repo");
    });
  });

  describe("元数据提取", () => {
    test("extracts stars, forks, and today stars from metadata", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/user/repo"> user / repo </a></h2>
          <p>Great repository</p>
          <span itemprop="programmingLanguage">Rust</span>
          <div class="float-sm">
            <a href="/user/repo/stargazers">12k stars</a>
            <a href="/user/repo/network/members">1.2k forks</a>
            234 stars today
          </div>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");

      expect(metadata.stars).toBe("12k");
      expect(metadata.forks).toBe("1.2k");
      expect(metadata.todayStars).toBe("234");
      expect(metadata.language).toBe("Rust");
    });

    test("extracts author and repo name from title", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/openai/gpt-4"> openai / gpt-4 </a></h2>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");

      expect(metadata.author).toBe("openai");
      expect(metadata.repo).toBe("gpt-4");
    });

    test("includes today stars in snippet when available", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/user/repo"> user / repo </a></h2>
          <p>A great repo</p>
          <span itemprop="programmingLanguage">Go</span>
          <div class="float-sm">
            567 stars today
          </div>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");

      expect(items[0]?.snippet).toContain("+567 stars today");
    });
  });

  describe("健壮性", () => {
    test("handles missing description gracefully", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/user/repo"> user / repo </a></h2>
          <span itemprop="programmingLanguage">TypeScript</span>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");

      expect(items).toHaveLength(1);
      expect(items[0]?.url).toBe("https://github.com/user/repo");
    });

    test("handles missing language gracefully", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/user/repo"> user / repo </a></h2>
          <p>No language specified</p>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");
      const metadata = JSON.parse(items[0]?.metadataJson ?? "{}");

      expect(items).toHaveLength(1);
      expect(metadata.language).toBeUndefined();
    });

    test("handles malformed article without crashing", () => {
      const html = `
        <article class="Box-row">
          <p>Some content without proper title</p>
        </article>
        <article class="Box-row">
          <h2><a href="/user/repo"> user / repo </a></h2>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");

      // 第一个 article 没有 href，应该被过滤掉
      // 第二个 article 应该被解析
      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe("user / repo");
    });

    test("handles trending page link format", () => {
      const html = `
        <article class="Box-row">
          <h2><a href="/developers?since=daily"> developer link </a></h2>
        </article>
      `;

      const items = parseGitHubTrendingHtml(html, "github-trending");

      expect(items).toHaveLength(1);
      // 绝对路径会被正确解析
      expect(items[0]?.url).toBe("https://github.com/developers?since=daily");
    });
  });
});

describe("collectGitHubTrendingSource", () => {
  describe("错误处理", () => {
    test("throws on non-OK response", async () => {
      const mockFetch = async () =>
        new Response("Not Found", { status: 404, statusText: "Not Found" });

      const source = {
        id: "github-trending",
        type: "github_trending" as const,
        enabled: true,
        url: "https://github.com/trending",
      };

      await expect(collectGitHubTrendingSource(source, mockFetch as unknown as typeof fetch)).rejects.toThrow(
        "GitHub Trending returned 404: Not Found",
      );
    });

    test("throws on timeout", async () => {
      const controller = new AbortController();
      controller.abort(); // 立即 abort

      const mockFetch = async (_url: string, init?: RequestInit) => {
        // 检查 signal 是否已 abort
        if (init?.signal?.aborted) {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          throw error;
        }
        return new Response("<html></html>");
      };

      const source = {
        id: "github-trending",
        type: "github_trending" as const,
        enabled: true,
        url: "https://github.com/trending",
      };

      // 传入一个已经 abort 的 signal
      const fetchWithAbort = async (url: string, init?: RequestInit) => {
        return mockFetch(url, { ...init, signal: controller.signal });
      };

      await expect(collectGitHubTrendingSource(source, fetchWithAbort as unknown as typeof fetch)).rejects.toThrow();
    });

    test("throws on empty response", async () => {
      const mockFetch = async () =>
        new Response("", { status: 200, headers: { "content-type": "text/html" } });

      const source = {
        id: "github-trending",
        type: "github_trending" as const,
        enabled: true,
        url: "https://github.com/trending",
      };

      await expect(collectGitHubTrendingSource(source, mockFetch as unknown as typeof fetch)).rejects.toThrow(
        "returned empty response",
      );
    });

    test("throws on unexpected content type", async () => {
      const mockFetch = async () =>
        new Response("{}", { status: 200, headers: { "content-type": "application/json" } });

      const source = {
        id: "github-trending",
        type: "github_trending" as const,
        enabled: true,
        url: "https://github.com/trending",
      };

      await expect(collectGitHubTrendingSource(source, mockFetch as unknown as typeof fetch)).rejects.toThrow(
        "unexpected content type",
      );
    });

    test("throws when HTML structure changed", async () => {
      const mockFetch = async () =>
        new Response("<html><body>No articles here</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });

      const source = {
        id: "github-trending",
        type: "github_trending" as const,
        enabled: true,
        url: "https://github.com/trending",
      };

      await expect(collectGitHubTrendingSource(source, mockFetch as unknown as typeof fetch)).rejects.toThrow(
        "no <article> elements found",
      );
    });
  });

  describe("正常流程", () => {
    test("successfully parses valid HTML response", async () => {
      const mockFetch = async () =>
        new Response(
          `
          <html>
            <body>
              <article class="Box-row">
                <h2><a href="/test/repo"> test / repo </a></h2>
                <p>Test repository</p>
                <span itemprop="programmingLanguage">TypeScript</span>
              </article>
            </body>
          </html>
        `,
          { status: 200, headers: { "content-type": "text/html" } },
        );

      const source = {
        id: "github-trending",
        type: "github_trending" as const,
        enabled: true,
        url: "https://github.com/trending",
      };

      const items = await collectGitHubTrendingSource(source, mockFetch as unknown as typeof fetch);

      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe("test / repo");
      expect(items[0]?.url).toBe("https://github.com/test/repo");
    });

    test("uses source URL when provided", async () => {
      let fetchedUrl = "";
      const mockFetch = async (url: string) => {
        fetchedUrl = url;
        return new Response(`<article><h2><a href="/user/repo">user / repo</a></h2></article>`, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      };

      const source = {
        id: "github-trending",
        type: "github_trending" as const,
        enabled: true,
        url: "https://github.com/trending/python",
      };

      await collectGitHubTrendingSource(source, mockFetch as unknown as typeof fetch);

      // 验证使用了正确的 URL
      expect(fetchedUrl).toContain("python");
    });
  });
});
