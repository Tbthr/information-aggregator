import type { QueryResult } from "../query/run-query";
import type { ViewModel, ViewModelItem } from "./registry";
import type { HighlightsResult } from "../types/index";
import type { AiClient } from "../ai/client";

function relationSummary(result: QueryResult["rankedItems"][number]): string | undefined {
  if (!result.linkedCanonicalUrl) {
    return undefined;
  }
  return result.relationshipToCanonical === "discussion" ? "discussion source" : "linked article";
}

export interface DailyBriefViewOptions {
  aiClient?: AiClient | null;
}

export async function buildDailyBriefView(result: QueryResult, options?: DailyBriefViewOptions): Promise<ViewModel> {
  const viewModel: ViewModel = {
    viewId: "daily-brief",
    title: "Daily Brief",
    highlights: result.rankedItems.slice(0, 3).map((item) => item.title ?? item.normalizedTitle ?? item.id),
    sections: [
      {
        title: "Top Clusters",
        items: result.clusters.map((cluster) => ({
          title: cluster.title ?? cluster.canonicalItemId,
          url: cluster.url,
          summary: cluster.summary ?? "Why it matters",
        })),
      },
      {
        title: "Supporting Items",
        items: result.rankedItems.slice(3).map((item) => ({
          title: item.title ?? item.normalizedTitle ?? item.id,
          url: item.linkedCanonicalUrl ?? item.url ?? item.canonicalUrl,
          summary: relationSummary(item),
        })),
      },
    ],
  };

  // 生成趋势洞察
  if (options?.aiClient) {
    const topTitles = result.rankedItems.slice(0, 10).map((item) => item.title ?? item.normalizedTitle ?? item.id);
    if (topTitles.length >= 3) {
      try {
        const highlights = await options.aiClient.generateHighlights(topTitles);
        if (highlights) {
          viewModel.aiHighlights = highlights;
          viewModel.summary = highlights.summary;
        }
      } catch (error) {
        console.error("Failed to generate highlights:", error);
      }
    }
  }

  return viewModel;
}

export function renderDailyBriefView(
  model: ViewModel,
  renderDigest: (input: {
    narration?: string;
    highlights: string[];
    clusters: Array<{ title: string; summary: string; url: string }>;
    supportingItems?: Array<{ title: string; url: string; summary?: string }>;
    aiHighlights?: HighlightsResult;
  }) => string,
): string {
  const aiHighlights = model.aiHighlights;
  return renderDigest({
    narration: model.summary,
    highlights: model.highlights ?? [],
    clusters: (model.sections.find((section) => section.title === "Top Clusters")?.items ?? []).map((item) => ({
      title: item.title,
      summary: item.summary ?? "Why it matters",
      url: item.url ?? "",
    })),
    supportingItems: (model.sections.find((section) => section.title === "Supporting Items")?.items ?? []).map((item: ViewModelItem) => ({
      title: item.title,
      url: item.url ?? "",
      summary: item.summary,
    })),
    aiHighlights: aiHighlights ?? undefined,
  });
}
