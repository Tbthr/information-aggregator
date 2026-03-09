import type { Source } from "../types/index";

export function getRealProbeSources(): Source[] {
  return [
    {
      id: "github-changelog",
      name: "GitHub Changelog RSS",
      type: "rss",
      enabled: true,
      url: "https://github.blog/changelog/feed/",
      configJson: "{}",
    },
    {
      id: "jsonfeed-site",
      name: "JSON Feed",
      type: "json-feed",
      enabled: true,
      url: "https://www.jsonfeed.org/feed.json",
      configJson: "{}",
    },
    {
      id: "jsonfeed-home",
      name: "JSON Feed Website",
      type: "website",
      enabled: true,
      url: "https://www.jsonfeed.org/",
      configJson: "{}",
    },
  ];
}

export function probeLooksHealthy(markdown: string): boolean {
  return markdown.includes("](") || markdown.includes("http");
}
