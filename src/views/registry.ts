import { renderDigestMarkdown } from "../render/digest";
import { renderScanMarkdown } from "../render/scan";
import type { QueryResult } from "../query/run-query";
import { buildDailyBriefView, renderDailyBriefView } from "./daily-brief";
import { buildItemListView, renderItemListView } from "./item-list";
import { buildXBookmarksAnalysisView, renderXAnalysisView } from "./x-bookmarks-analysis";
import { buildXLikesAnalysisView } from "./x-likes-analysis";
import { buildXLongformHotView, renderXLongformHotView } from "./x-longform-hot";

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
}

export function buildViewModel(result: QueryResult, viewId: string): ViewModel {
  switch (viewId) {
    case "item-list":
      return buildItemListView(result);
    case "daily-brief":
      return buildDailyBriefView(result);
    case "x-bookmarks-analysis":
      return buildXBookmarksAnalysisView(result);
    case "x-likes-analysis":
      return buildXLikesAnalysisView(result);
    case "x-longform-hot":
      return buildXLongformHotView(result);
    default:
      return buildItemListView(result);
  }
}

export function renderViewMarkdown(model: ViewModel, viewId: string): string {
  switch (viewId) {
    case "item-list":
      return renderItemListView(model, renderScanMarkdown);
    case "daily-brief":
      return renderDailyBriefView(model, renderDigestMarkdown);
    case "x-bookmarks-analysis":
    case "x-likes-analysis":
      return renderXAnalysisView(model);
    case "x-longform-hot":
      return renderXLongformHotView(model);
    default:
      return renderItemListView(model, renderScanMarkdown);
  }
}
