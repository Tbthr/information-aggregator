import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createAiClient, clearSettingsCache, AnthropicClient, GeminiClient, ProviderAiClient } from "./client";
import type { AnthropicConfig, GeminiConfig, AiProviderConfig } from "./types";

describe("createAiClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 清除设置缓存
    clearSettingsCache();
    // 清除环境变量
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("OpenAI provider", () => {
    test("returns null when no config or env vars exist", async () => {
      const client = await createAiClient("openai", {});
      expect(client).toBeNull();
    });

    test("calls configured provider with prompt payload", async () => {
      const calls: unknown[] = [];
      const client = await createAiClient("openai", {
        baseUrl: "https://provider.example",
        model: "test-model",
        apiKey: "secret",
        fetch: async (_url, init) => {
          calls.push(JSON.parse(String(init?.body)));
          return new Response(JSON.stringify({ output_text: "0.82" }), { status: 200 });
        },
      });

      const result = await client?.scoreCandidate("prompt text");
      expect(result).toBe(0.82);
      expect(calls).toEqual([
        {
          model: "test-model",
          input: "prompt text",
        },
      ]);
    });

    test("returns text responses for summaries and narration", async () => {
      const client = await createAiClient("openai", {
        baseUrl: "https://provider.example",
        model: "test-model",
        apiKey: "secret",
        fetch: async () => new Response(JSON.stringify({ output_text: "summary text" }), { status: 200 }),
      });

      await expect(client?.summarizeCluster("cluster prompt")).resolves.toBe("summary text");
      await expect(client?.narrateDigest("digest prompt")).resolves.toBe("summary text");
    });

    test("throws on failed request", async () => {
      const client = await createAiClient("openai", {
        apiKey: "secret",
        model: "test-model",
        fetch: async () => new Response("error", { status: 401 }),
      });

      await expect(client?.scoreCandidate("test")).rejects.toThrow("AI provider request failed: 401");
    });
  });

  describe("Anthropic provider", () => {
    test("returns null when no config or env vars exist", async () => {
      const client = await createAiClient("anthropic", {});
      expect(client).toBeNull();
    });

    test("returns client when authToken and model are provided", async () => {
      const client = await createAiClient("anthropic", { authToken: "token", model: "claude-3-5-sonnet-latest" });
      expect(client).not.toBeNull();
      expect(client).toBeInstanceOf(AnthropicClient);
    });

    test("returns null when only model is provided", async () => {
      const client = await createAiClient("anthropic", { model: "GLM-5" });
      expect(client).toBeNull();
    });

    test("uses explicit config over env vars", async () => {
      process.env.ANTHROPIC_AUTH_TOKEN = "env-token";
      process.env.ANTHROPIC_MODEL = "env-model";
      process.env.ANTHROPIC_BASE_URL = "https://env.example";

      const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
      const client = await createAiClient("anthropic", {
        authToken: "config-token",
        model: "GLM-5",
        baseUrl: "https://open.bigmodel.cn/api/anthropic",
        fetch: async (url, init) => {
          calls.push({
            url: String(url),
            body: JSON.parse(String(init?.body)),
            headers: init?.headers as Record<string, string>,
          });
          return new Response(
            JSON.stringify({
              content: [{ type: "text", text: "0.95" }],
            }),
            { status: 200 }
          );
        },
      });

      const result = await client?.scoreCandidate("test prompt");
      expect(result).toBe(0.95);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://open.bigmodel.cn/api/anthropic/v1/messages");
      expect(calls[0].body).toEqual({
        model: "GLM-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: "test prompt" }],
      });
      expect(calls[0].headers["x-api-key"]).toBe("config-token");
      expect(calls[0].headers["anthropic-version"]).toBe("2023-06-01");
    });

    test("uses env vars when config not provided", async () => {
      process.env.ANTHROPIC_AUTH_TOKEN = "env-auth-token";
      process.env.ANTHROPIC_MODEL = "GLM-5";
      process.env.ANTHROPIC_BASE_URL = "https://open.bigmodel.cn/api/anthropic";

      const calls: { url: string; body: unknown }[] = [];
      const client = await createAiClient("anthropic", {
        model: "GLM-5",  // 显式提供 model（settings.yaml 中的 model 优先）
        fetch: async (url, init) => {
          calls.push({
            url: String(url),
            body: JSON.parse(String(init?.body)),
          });
          return new Response(
            JSON.stringify({
              content: [{ type: "text", text: "response text" }],
            }),
            { status: 200 }
          );
        },
      });

      await client?.summarizeCluster("cluster prompt");
      expect(calls[0].url).toBe("https://open.bigmodel.cn/api/anthropic/v1/messages");
      expect(calls[0].body).toEqual({
        model: "GLM-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: "cluster prompt" }],
      });
    });

    test("defaults to Anthropic API URL when baseUrl not specified", async () => {
      process.env.ANTHROPIC_AUTH_TOKEN = "token";
      process.env.ANTHROPIC_MODEL = "claude-3";

      const calls: string[] = [];
      const client = await createAiClient("anthropic", {
        fetch: async (url) => {
          calls.push(String(url));
          return new Response(
            JSON.stringify({
              content: [{ type: "text", text: "ok" }],
            }),
            { status: 200 }
          );
        },
      });

      await client?.narrateDigest("prompt");
      expect(calls[0]).toBe("https://api.anthropic.com/v1/messages");
    });

    test("parses score from Anthropic response format", async () => {
      const client = await createAiClient("anthropic", {
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

      const result = await client?.scoreCandidate("rate this");
      expect(result).toBe(7.5);
    });

    test("extracts text from Anthropic response for summaries", async () => {
      const client = await createAiClient("anthropic", {
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

      const result = await client?.summarizeCluster("summarize this");
      expect(result).toBe("This is a summary.");
    });

    test("throws on failed request", async () => {
      const client = await createAiClient("anthropic", {
        authToken: "token",
        model: "GLM-5",
        fetch: async () => new Response("error", { status: 401 }),
      });

      await expect(client?.scoreCandidate("test")).rejects.toThrow("Anthropic request failed: 401");
    });

    test("throws on invalid response format", async () => {
      const client = await createAiClient("anthropic", {
        authToken: "token",
        model: "GLM-5",
        fetch: async () => new Response(JSON.stringify({ content: [] }), { status: 200 }),
      });

      await expect(client?.summarizeCluster("test")).rejects.toThrow(
        "Anthropic response did not contain text content"
      );
    });
  });

  describe("Gemini provider", () => {
    test("returns null when no config or env vars exist", async () => {
      const client = await createAiClient("gemini", {});
      expect(client).toBeNull();
    });

    test("returns client when apiKey and model are provided via config", async () => {
      const client = await createAiClient("gemini", { apiKey: "test-key", model: "gemini-2.0-flash" });
      expect(client).not.toBeNull();
    });

    test("returns client when GEMINI_API_KEY and GEMINI_MODEL env vars are set", async () => {
      process.env.GEMINI_API_KEY = "env-key";
      process.env.GEMINI_MODEL = "gemini-2.0-flash";
      const client = await createAiClient("gemini");
      expect(client).not.toBeNull();
    });

    test("uses explicit config over env vars", async () => {
      process.env.GEMINI_API_KEY = "env-key";
      process.env.GEMINI_MODEL = "env-model";

      const calls: { url: string; body: unknown }[] = [];
      const client = await createAiClient("gemini", {
        apiKey: "config-key",
        model: "gemini-2.0-pro",
        fetch: async (url, init) => {
          calls.push({
            url: String(url),
            body: JSON.parse(String(init?.body)),
          });
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "0.88" }] } }],
            }),
            { status: 200 }
          );
        },
      });

      const result = await client?.scoreCandidate("test prompt");
      expect(result).toBe(0.88);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain("gemini-2.0-pro:generateContent");
      expect(calls[0].url).toContain("key=config-key");
      expect(calls[0].body).toEqual({
        contents: [{ parts: [{ text: "test prompt" }] }],
        generationConfig: { temperature: 0.3, topP: 0.8, topK: 40 },
      });
    });

    test("uses model from config", async () => {
      const calls: string[] = [];
      const client = await createAiClient("gemini", {
        apiKey: "test-key",
        model: "gemini-2.0-flash",
        fetch: async (url) => {
          calls.push(String(url));
          return new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "ok" }] } }],
            }),
            { status: 200 }
          );
        },
      });

      await client?.narrateDigest("prompt");
      expect(calls[0]).toContain("gemini-2.0-flash:generateContent");
    });

    test("parses score from Gemini response format", async () => {
      const client = await createAiClient("gemini", {
        apiKey: "test-key",
        fetch: async () =>
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "The score is 8.5" }] } }],
            }),
            { status: 200 }
          ),
      });

      const result = await client?.scoreCandidate("rate this");
      expect(result).toBe(8.5);
    });

    test("extracts text from Gemini response for summaries", async () => {
      const client = await createAiClient("gemini", {
        apiKey: "test-key",
        fetch: async () =>
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "  This is a summary.  " }] } }],
            }),
            { status: 200 }
          ),
      });

      const result = await client?.summarizeCluster("summarize this");
      expect(result).toBe("This is a summary.");
    });

    test("throws on failed request", async () => {
      const client = await createAiClient("gemini", {
        apiKey: "test-key",
        fetch: async () => new Response("error", { status: 401 }),
      });

      await expect(client?.scoreCandidate("test")).rejects.toThrow("Gemini request failed: 401");
    });

    test("throws on invalid response format", async () => {
      const client = await createAiClient("gemini", {
        apiKey: "test-key",
        fetch: async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
      });

      await expect(client?.summarizeCluster("test")).rejects.toThrow(
        "Gemini response did not contain candidates"
      );
    });

    test("throws on missing text in response", async () => {
      const client = await createAiClient("gemini", {
        apiKey: "test-key",
        fetch: async () =>
          new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{}] } }] }),
            { status: 200 }
          ),
      });

      await expect(client?.summarizeCluster("test")).rejects.toThrow(
        "Gemini response did not contain text"
      );
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
});

describe("GeminiClient (direct)", () => {
  test("can be instantiated directly with model", async () => {
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
