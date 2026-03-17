import type { AiClient } from "../ai/client";
import type { HighlightsResult } from "../types/index";

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
