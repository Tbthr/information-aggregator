import type { Source } from "../types/index";

export function getRealProbeSources(): Source[] {
  return [
    {
      id: "github-changelog",
      type: "rss",
      enabled: true,
      url: "https://github.blog/changelog/feed/",
      configJson: "{}",
    },
    {
      id: "jsonfeed-site",
      type: "json-feed",
      enabled: true,
      url: "https://www.jsonfeed.org/feed.json",
      configJson: "{}",
    },
    {
      id: "jsonfeed-home",
      type: "website",
      enabled: true,
      url: "https://www.jsonfeed.org/",
      configJson: "{}",
    },
    {
      id: "hn-front-page",
      type: "hn",
      enabled: true,
      url: "https://hn.algolia.com/api/v1/search?tags=front_page",
      configJson: "{}",
    },
    {
      id: "reddit-machine-learning",
      type: "reddit",
      enabled: true,
      url: "https://www.reddit.com/r/MachineLearning/.json",
      configJson: "{}",
    },
    {
      id: "github-trending",
      type: "github_trending",
      enabled: true,
      url: "https://github.com/trending",
      configJson: "{}",
    },
    {
      id: "clawfeed-kevin",
      type: "digest_feed",
      enabled: true,
      url: "https://clawfeed.kevinhe.io/feed/kevin",
      configJson: JSON.stringify({
        format: "json",
        itemPath: "digests",
        contentField: "content",
      }),
    },
  ];
}

export function probeLooksHealthy(markdown: string): boolean {
  return markdown.includes("](") || markdown.includes("http");
}
