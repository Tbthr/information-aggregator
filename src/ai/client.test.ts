import { describe, expect, test } from "bun:test";
import { createAiClient } from "./client";

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
