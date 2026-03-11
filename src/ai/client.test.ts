import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createAiClient, createAnthropicClient } from "./client";

describe("createAiClient", () => {
  test("returns null when no provider config exists", () => {
    expect(createAiClient({})).toBeNull();
  });

  test("calls configured provider with prompt payload", async () => {
    const calls: unknown[] = [];
    const client = createAiClient({
      provider: "openai-compatible",
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
    const client = createAiClient({
      provider: "openai-compatible",
      baseUrl: "https://provider.example",
      model: "test-model",
      apiKey: "secret",
      fetch: async () => new Response(JSON.stringify({ output_text: "summary text" }), { status: 200 }),
    });

    await expect(client?.summarizeCluster("cluster prompt")).resolves.toBe("summary text");
    await expect(client?.narrateDigest("digest prompt")).resolves.toBe("summary text");
  });
});

describe("createAnthropicClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_BASE_URL;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  test("returns null when no config or env vars exist", () => {
    expect(createAnthropicClient()).toBeNull();
  });

  test("returns null when only authToken is provided", () => {
    expect(createAnthropicClient({ authToken: "token" })).toBeNull();
  });

  test("returns null when only model is provided", () => {
    expect(createAnthropicClient({ model: "GLM-5" })).toBeNull();
  });

  test("uses explicit config over env vars", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "env-token";
    process.env.ANTHROPIC_MODEL = "env-model";
    process.env.ANTHROPIC_BASE_URL = "https://env.example";

    const calls: { url: string; body: unknown; headers: Record<string, string> }[] = [];
    const client = createAnthropicClient({
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
    const client = createAnthropicClient({
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
    const client = createAnthropicClient({
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
    const client = createAnthropicClient({
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
    const client = createAnthropicClient({
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
    const client = createAnthropicClient({
      authToken: "token",
      model: "GLM-5",
      fetch: async () => new Response("error", { status: 401 }),
    });

    await expect(client?.scoreCandidate("test")).rejects.toThrow("Anthropic request failed: 401");
  });

  test("throws on invalid response format", async () => {
    const client = createAnthropicClient({
      authToken: "token",
      model: "GLM-5",
      fetch: async () => new Response(JSON.stringify({ content: [] }), { status: 200 }),
    });

    await expect(client?.summarizeCluster("test")).rejects.toThrow(
      "Anthropic response did not contain text content"
    );
  });
});
