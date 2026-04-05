export interface AiProviderConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface AnthropicConfig {
  authToken: string;
  model: string;
  baseUrl?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

interface GeminiResponsePart {
  text?: string;
}

interface GeminiResponseContent {
  parts: GeminiResponsePart[];
}

interface GeminiResponseCandidate {
  content: GeminiResponseContent;
}

export interface GeminiResponse {
  candidates: GeminiResponseCandidate[];
}

export interface TopicSuggestion {
  title: string;
  description: string;
  sourceLinks: string[];
}

export interface AiClient {
  scoreCandidate(prompt: string): Promise<number>;
  summarizeCluster(prompt: string): Promise<string>;
  narrateDigest(prompt: string): Promise<string>;
  generateText(prompt: string): Promise<string>;
  suggestTopics(prompt: string): Promise<TopicSuggestion[]>;
  summarizeItem(title: string, content: string): Promise<string>;
  complete(options: { system?: string; prompt: string; maxTokens?: number }): Promise<string>;
}
