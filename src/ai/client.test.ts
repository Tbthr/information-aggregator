import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createAiClient, clearAiConfigCache, AnthropicClient, GeminiClient, ProviderAiClient } from "./client";

describe("createAiClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearAiConfigCache();
    // 清除所有 AI 相关环境变量
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("ANTHROPIC_") || key.startsWith("GEMINI_") || key.startsWith("OPENAI_") || key.startsWith("AI_")) {
        delete process.env[key];
      }
    }
    // 禁用重试以加速测试
    process.env.AI_MAX_RETRIES = "0";
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    clearAiConfigCache();
  });

  describe("returns null when no config", () => {
    test("openai: no env vars", () => {
      expect(createAiClient("openai")).toBeNull();
    });

    test("anthropic: no env vars", () => {
      expect(createAiClient("anthropic")).toBeNull();
    });

    test("gemini: no env vars", () => {
      expect(createAiClient("gemini")).toBeNull();
    });

    test("default provider when no env vars", () => {
      expect(createAiClient()).toBeNull();
    });
  });

  describe("returns client when env vars are set", () => {
    test("openai: returns ProviderAiClient", () => {
      process.env.OPENAI_API_KEYS = "sk-test";
      process.env.OPENAI_MODEL = "gpt-4o";
      const client = createAiClient("openai");
      expect(client).toBeInstanceOf(ProviderAiClient);
    });

    test("anthropic: returns AnthropicClient", () => {
      process.env.ANTHROPIC_API_KEYS = "sk-ant-test";
      process.env.ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
      const client = createAiClient("anthropic");
      expect(client).toBeInstanceOf(AnthropicClient);
    });

    test("gemini: returns GeminiClient", () => {
      process.env.GEMINI_API_KEYS = "test-key";
      process.env.GEMINI_MODEL = "gemini-2.0-flash";
      const client = createAiClient("gemini");
      expect(client).toBeInstanceOf(GeminiClient);
    });
  });

  describe("uses AI_DEFAULT_PROVIDER", () => {
    test("defaults to anthropic when not set", () => {
      process.env.ANTHROPIC_API_KEYS = "sk-ant-test";
      process.env.ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
      expect(createAiClient()).toBeInstanceOf(AnthropicClient);
    });

    test("respects AI_DEFAULT_PROVIDER=gemini", () => {
      process.env.AI_DEFAULT_PROVIDER = "gemini";
      process.env.GEMINI_API_KEYS = "test-key";
      process.env.GEMINI_MODEL = "gemini-2.0-flash";
      expect(createAiClient()).toBeInstanceOf(GeminiClient);
    });
  });

  describe("multiple endpoints (fallback)", () => {
    test("returns FallbackAiClient for multiple keys", () => {
      process.env.ANTHROPIC_API_KEYS = "key1,key2";
      process.env.ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
      const client = createAiClient("anthropic");
      expect(client).not.toBeNull();
      // FallbackAiClient wraps the provider client
      expect(client!.constructor.name).toBe("FallbackAiClient");
    });
  });
});

describe("AnthropicClient (direct)", () => {
  test("can be instantiated directly", async () => {
    const calls: string[] = [];
    const client = new AnthropicClient({
      authToken: "token",
      model: "claude-3",
      fetch: async (url) => {
        calls.push(String(url));
        return new Response(
          JSON.stringify({ content: [{ type: "text", text: "ok" }] }),
          { status: 200 }
        );
      },
    });

    await client.narrateDigest("prompt");
    expect(calls[0]).toBe("https://api.anthropic.com/v1/messages");
  });

  test("uses custom baseUrl", async () => {
    const calls: string[] = [];
    const client = new AnthropicClient({
      authToken: "token",
      model: "GLM-5",
      baseUrl: "https://open.bigmodel.cn/api/anthropic",
      fetch: async (url) => {
        calls.push(String(url));
        return new Response(
          JSON.stringify({ content: [{ type: "text", text: "0.95" }] }),
          { status: 200 }
        );
      },
    });

    await client.scoreCandidate("test prompt");
    expect(calls[0]).toBe("https://open.bigmodel.cn/api/anthropic/v1/messages");
  });

  test("parses score from response", async () => {
    const client = new AnthropicClient({
      authToken: "token",
      model: "GLM-5",
      fetch: async () =>
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: "The score is 7.5 out of 10" }],
          }),
          { status: 200 }
        ),
    });

    const result = await client.scoreCandidate("rate this");
    expect(result).toBe(7.5);
  });

  test("extracts text from response for summaries", async () => {
    const client = new AnthropicClient({
      authToken: "token",
      model: "GLM-5",
      fetch: async () =>
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: "  This is a summary.  " }],
          }),
          { status: 200 }
        ),
    });

    const result = await client.summarizeCluster("summarize this");
    expect(result).toBe("This is a summary.");
  });

  test("throws on failed request", async () => {
    const client = new AnthropicClient({
      authToken: "token",
      model: "GLM-5",
      fetch: async () => new Response("error", { status: 401 }),
    });

    await expect(client.scoreCandidate("test")).rejects.toThrow("Anthropic request failed: 401");
  });

  test("throws on invalid response format", async () => {
    const client = new AnthropicClient({
      authToken: "token",
      model: "GLM-5",
      fetch: async () => new Response(JSON.stringify({ content: [] }), { status: 200 }),
    });

    await expect(client.summarizeCluster("test")).rejects.toThrow(
      "Anthropic response did not contain text content"
    );
  });
});

describe("GeminiClient (direct)", () => {
  test("can be instantiated directly", async () => {
    const calls: string[] = [];
    const client = new GeminiClient({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      fetch: async (url) => {
        calls.push(String(url));
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
          { status: 200 }
        );
      },
    });

    await client.narrateDigest("prompt");
    expect(calls[0]).toContain("gemini-2.0-flash:generateContent");
  });

  test("parses score from response", async () => {
    const client = new GeminiClient({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      fetch: async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "The score is 8.5" }] } }],
          }),
          { status: 200 }
        ),
    });

    const result = await client.scoreCandidate("rate this");
    expect(result).toBe(8.5);
  });

  test("extracts text from response for summaries", async () => {
    const client = new GeminiClient({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      fetch: async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "  This is a summary.  " }] } }],
          }),
          { status: 200 }
        ),
    });

    const result = await client.summarizeCluster("summarize this");
    expect(result).toBe("This is a summary.");
  });

  test("throws on failed request", async () => {
    const client = new GeminiClient({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      fetch: async () => new Response("error", { status: 401 }),
    });

    await expect(client.scoreCandidate("test")).rejects.toThrow("Gemini request failed: 401");
  });

  test("throws on invalid response format", async () => {
    const client = new GeminiClient({
      apiKey: "test-key",
      model: "gemini-2.0-flash",
      fetch: async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    });

    await expect(client.summarizeCluster("test")).rejects.toThrow(
      "Gemini response did not contain candidates"
    );
  });
});

describe("ProviderAiClient (direct)", () => {
  test("can be instantiated directly", async () => {
    const calls: unknown[] = [];
    const client = new ProviderAiClient({
      apiKey: "secret",
      model: "test-model",
      baseUrl: "https://provider.example",
      fetch: async (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ output_text: "0.82" }), { status: 200 });
      },
    });

    const result = await client.scoreCandidate("prompt text");
    expect(result).toBe(0.82);
    expect(calls).toEqual([{ model: "test-model", input: "prompt text" }]);
  });
});
