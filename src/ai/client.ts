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

export {
  createAiClient,
  createAnthropicClient,
  createGeminiClient,
  ProviderAiClient,
  AnthropicClient,
  GeminiClient,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_ANTHROPIC_MODEL,
} from "./providers";
