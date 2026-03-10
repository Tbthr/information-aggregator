import { describe, expect, test } from "bun:test";

import { parseGitHubTrendingHtml } from "./github-trending";

describe("parseGitHubTrendingHtml", () => {
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
});
