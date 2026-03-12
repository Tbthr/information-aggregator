import type { HighlightsResult } from "../types/index";

interface DigestCluster {
  title: string;
  summary: string;
  url: string;
}

export function renderDigestMarkdown(input: {
  narration?: string;
  highlights: string[];
  clusters: DigestCluster[];
  supportingItems?: Array<{ title: string; url: string; summary?: string }>;
  aiHighlights?: HighlightsResult;
}): string {
  const lines = ["# Daily Digest"];

  if (input.narration) {
    lines.push("", "## Narration", input.narration);
  }

  // AI 生成的「今日看点」板块
  if (input.aiHighlights) {
    lines.push("", "## 今日看点", input.aiHighlights.summary);
    if (input.aiHighlights.trends.length > 0) {
      lines.push("", "### 主要趋势");
      for (const trend of input.aiHighlights.trends) {
        lines.push(`- ${trend}`);
      }
    }
  }

  lines.push("", "## Highlights");
  for (const highlight of input.highlights) {
    lines.push(`- ${highlight}`);
  }

  lines.push("", "## Top Clusters");
  for (const cluster of input.clusters) {
    lines.push(`- [${cluster.title}](${cluster.url})`);
    lines.push(`  - ${cluster.summary}`);
  }

  lines.push("", "## Supporting Items");
  for (const item of input.supportingItems ?? []) {
    lines.push(`- [${item.title}](${item.url})`);
    if (item.summary) {
      lines.push(`  - ${item.summary}`);
    }
  }

  return lines.join("\n");
}
