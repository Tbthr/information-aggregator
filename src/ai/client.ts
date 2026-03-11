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

export interface AiClient {
  scoreCandidate(prompt: string): Promise<number>;
  summarizeCluster(prompt: string): Promise<string>;
  narrateDigest(prompt: string): Promise<string>;
}

function getFetchImpl(fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return fetchFn ?? fetch;
}

function getBaseUrl(config: AiProviderConfig): string {
  return (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
}

function getOpenAiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid AI response payload");
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim() !== "") {
    return record.output_text.trim();
  }

  const output = record.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim() !== "") {
          return text.trim();
        }
      }
    }
  }

  throw new Error("AI response did not contain output text");
}

function getAnthropicResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Anthropic response payload");
  }

  const record = payload as Record<string, unknown>;
  const content = record.content;

  if (!Array.isArray(content)) {
    throw new Error("Anthropic response did not contain content array");
  }

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const blockRecord = block as Record<string, unknown>;
    if (blockRecord.type === "text" && typeof blockRecord.text === "string") {
      const text = blockRecord.text.trim();
      if (text !== "") {
        return text;
      }
    }
  }

  throw new Error("Anthropic response did not contain text content");
}

function parseScore(payload: unknown, responseParser: (p: unknown) => string): number {
  const text = responseParser(payload);
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    throw new Error(`AI score response did not contain a number: ${text}`);
  }

  return Number(match[0]);
}

class ProviderAiClient implements AiClient {
  constructor(private readonly config: Required<Pick<AiProviderConfig, "apiKey" | "model">> & AiProviderConfig) {}

  private async request(prompt: string): Promise<unknown> {
    const response = await getFetchImpl(this.config.fetch)(`${getBaseUrl(this.config)}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: prompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed: ${response.status}`);
    }

    return response.json();
  }

  async scoreCandidate(prompt: string): Promise<number> {
    return parseScore(await this.request(prompt), getOpenAiResponseText);
  }

  async summarizeCluster(prompt: string): Promise<string> {
    return getOpenAiResponseText(await this.request(prompt));
  }

  async narrateDigest(prompt: string): Promise<string> {
    return getOpenAiResponseText(await this.request(prompt));
  }
}

class AnthropicClient implements AiClient {
  constructor(private readonly config: AnthropicConfig) {}

  private async request(prompt: string): Promise<unknown> {
    const baseUrl = (this.config.baseUrl ?? "https://api.anthropic.com").replace(/\/+$/, "");
    const response = await getFetchImpl(this.config.fetch)(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.authToken,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status}`);
    }

    return response.json();
  }

  async scoreCandidate(prompt: string): Promise<number> {
    return parseScore(await this.request(prompt), getAnthropicResponseText);
  }

  async summarizeCluster(prompt: string): Promise<string> {
    return getAnthropicResponseText(await this.request(prompt));
  }

  async narrateDigest(prompt: string): Promise<string> {
    return getAnthropicResponseText(await this.request(prompt));
  }
}

export function createAiClient(config: AiProviderConfig): AiClient | null {
  if (!config.provider || !config.apiKey || !config.model) {
    return null;
  }

  return new ProviderAiClient({
    ...config,
    apiKey: config.apiKey,
    model: config.model,
  });
}

export function createAnthropicClient(config?: Partial<AnthropicConfig>): AiClient | null {
  const authToken = config?.authToken ?? process.env.ANTHROPIC_AUTH_TOKEN;
  const model = config?.model ?? process.env.ANTHROPIC_MODEL;
  const baseUrl = config?.baseUrl ?? process.env.ANTHROPIC_BASE_URL;

  if (!authToken || !model) {
    return null;
  }

  return new AnthropicClient({
    authToken,
    model,
    baseUrl,
    fetch: config?.fetch,
  });
}
