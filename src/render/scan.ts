export function renderScanMarkdown(
  items: Array<{ title: string; url: string; finalScore: number; sourceName: string; rationale?: string }>,
): string {
  const lines = ["# Scan Results", ""];

  for (const item of items) {
    lines.push(`- [${item.title}](${item.url})`);
    lines.push(`  - Source: ${item.sourceName}`);
    lines.push(`  - Score: ${item.finalScore.toFixed(2)}`);
    if (item.rationale) {
      lines.push(`  - Why: ${item.rationale}`);
    }
  }

  return lines.join("\n");
}
