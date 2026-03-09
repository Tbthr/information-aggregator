import { describe, expect, test } from "bun:test";
import { loadSourcesConfig } from "./load";

describe("loadSourcesConfig", () => {
  test("loads example source definitions", async () => {
    const sources = await loadSourcesConfig("config/sources.example.yaml");
    expect(Array.isArray(sources)).toBe(true);
  });
});
