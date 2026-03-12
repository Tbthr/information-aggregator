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

  // AI 生成的「今日看点」板块（包含 narration 内容）
  if (input.aiHighlights) {
    lines.push("", "## 今日看点", input.aiHighlights.summary);
    if (input.aiHighlights.trends.length > 0) {
      lines.push("", "### 主要趋势");
      for (const trend of input.aiHighlights.trends) {
        lines.push(`- ${trend}`);
      }
    }
  } else if (input.narration) {
    // 仅在没有 AI highlights 时显示 narration
    lines.push("", "## 摘要", input.narration);
  }

  lines.push("", "## Highlights");
  for (const highlight of input.highlights) {
    lines.push(`- ${highlight}`);
  }

  // 只显示有有效 summary 的 clusters（过滤掉占位符）
  const validClusters = input.clusters.filter(
    (c) => c.summary && c.summary !== "Why it matters"
  );
  if (validClusters.length > 0) {
    lines.push("", "## Top Clusters");
    for (const cluster of validClusters) {
      lines.push(`- [${cluster.title}](${cluster.url})`);
      lines.push(`  - ${cluster.summary}`);
    }
  }

  return lines.join("\n");
}
