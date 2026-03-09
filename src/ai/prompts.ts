export function buildCandidateQualityPrompt(title: string, snippet = ""): string {
  return `Score the information value of this candidate.\nTitle: ${title}\nSnippet: ${snippet}`;
}

export function buildClusterSummaryPrompt(title: string, items: string[]): string {
  return `Summarize the cluster titled "${title}" using these items:\n- ${items.join("\n- ")}`;
}

export function buildDigestNarrationPrompt(highlights: string[]): string {
  return `Write a concise digest narration for:\n- ${highlights.join("\n- ")}`;
}
