export interface AiProviderConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
}

export interface AiClient {
  summarize(prompt: string): Promise<string>;
}

class NullAiClient implements AiClient {
  async summarize(prompt: string): Promise<string> {
    return prompt;
  }
}

export function createAiClient(config: AiProviderConfig): AiClient | null {
  if (!config.provider || !config.apiKey) {
    return null;
  }

  return new NullAiClient();
}
