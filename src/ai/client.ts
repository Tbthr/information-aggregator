// AI Client 入口点
// 重导出所有类型和工厂函数

export type {
  AiProviderConfig,
  AnthropicConfig,
  GeminiConfig,
  GeminiResponse,
  TopicSuggestion,
  ArticleEnrichResult,
  PostSummaryResult,
  DailyBriefOverviewResult,
  AiClient,
} from "./types";

export type { AiSettings, AiProviderType } from "./config/schema";

export type { FilterItem, PackContext } from "./prompts-filter";

export type { FilterJudgment } from "../types/ai-response";

export {
  createAiClient,
  loadSettings,
  clearSettingsCache,
  ProviderAiClient,
  AnthropicClient,
  GeminiClient,
} from "./providers";
