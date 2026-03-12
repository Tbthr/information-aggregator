import type { AiClient } from "../ai/client";
import type { HighlightsResult } from "../types/index";
import { renderDigestMarkdown } from "../render/digest";
import type { QueryResult } from "../query/run-query";
import { buildDailyBriefView, renderDailyBriefView } from "./daily-brief";
import { buildXAnalysisView, renderXAnalysisView } from "./x-analysis";

export interface ViewModelItem {
  title: string;
  url?: string;
  summary?: string;
  score?: number;
}

export interface ViewModelSection {
  title: string;
  items: ViewModelItem[];
}

export interface ViewModel {
  viewId: string;
  title: string;
  summary?: string;
  highlights?: string[];
  sections: ViewModelSection[];
  /** AI 生成的趋势洞察 */
  aiHighlights?: HighlightsResult;
}

/**
 * 视图构建依赖项
 */
export interface BuildViewDependencies {
  aiClient?: AiClient | null;
}

export async function buildViewModel(
  result: QueryResult,
  viewId: string,
  dependencies?: BuildViewDependencies,
): Promise<ViewModel> {
  switch (viewId) {
    case "daily-brief":
      return buildDailyBriefView(result, { aiClient: dependencies?.aiClient });
    case "x-analysis":
      return buildXAnalysisView(result, dependencies);
    default:
      return buildDailyBriefView(result, { aiClient: dependencies?.aiClient });
  }
}

export function renderViewMarkdown(model: ViewModel, viewId: string): string {
  switch (viewId) {
    case "daily-brief":
      return renderDailyBriefView(model, renderDigestMarkdown);
    case "x-analysis":
      return renderXAnalysisView(model);
    default:
      return renderDailyBriefView(model, renderDigestMarkdown);
  }
}
