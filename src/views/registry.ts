import type { AiClient } from "../ai/client";
import type { HighlightsResult } from "../types/index";
import type { QueryResult } from "../query/run-query";
import { buildDailyBriefView, type DailyBriefViewModel } from "./daily-brief";
import { buildXAnalysisView, type XAnalysisViewModel } from "./x-analysis";
import { renderDailyBriefView, renderXAnalysisView } from "./render";

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
  /** 标签云 */
  tagCloud?: string[];
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
      return renderDailyBriefView(model);
    case "x-analysis":
      return renderXAnalysisView(model as XAnalysisViewModel);
    default:
      return renderDailyBriefView(model);
  }
}

// 重新导出类型
export type { DailyBriefViewModel } from "./daily-brief";
export type { XAnalysisViewModel } from "./x-analysis";
