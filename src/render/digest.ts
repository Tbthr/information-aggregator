interface DigestCluster {
  title: string;
  summary: string;
  url: string;
}

export function renderDigestMarkdown(input: {
  narration?: string;
  highlights: string[];
  clusters: DigestCluster[];
  supportingItems?: Array<{ title: string; url: string }>;
}): string {
  const lines = ["# Daily Digest"];

  if (input.narration) {
    lines.push("", "## Narration", input.narration);
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
  }

  return lines.join("\n");
}
