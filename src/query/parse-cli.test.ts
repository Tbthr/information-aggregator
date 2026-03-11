import { describe, expect, test } from "bun:test";
import { parseRunArgs, validateRunArgs } from "./parse-cli";

describe("parseRunArgs", () => {
  test("parses all required arguments", () => {
    const args = ["--pack", "ai-news", "--view", "daily-brief", "--window", "24h"];
    const result = parseRunArgs(args);
    expect(result.packIds).toEqual(["ai-news"]);
    expect(result.viewId).toBe("daily-brief");
    expect(result.window).toBe("24h");
  });

  test("parses multiple packs", () => {
    const args = ["--pack", "ai-news,engineering", "--view", "json", "--window", "7d"];
    const result = parseRunArgs(args);
    expect(result.packIds).toEqual(["ai-news", "engineering"]);
  });

  test("throws on unknown argument", () => {
    const args = ["--pack", "ai-news", "--unknown", "value"];
    expect(() => parseRunArgs(args)).toThrow("Unknown argument: --unknown");
  });

  test("throws on missing --pack", () => {
    const args = ["--view", "daily-brief", "--window", "24h"];
    expect(() => parseRunArgs(args)).toThrow("--pack is required");
  });

  test("throws on missing --view", () => {
    const args = ["--pack", "ai-news", "--window", "24h"];
    expect(() => parseRunArgs(args)).toThrow("--view is required");
  });

  test("throws on missing --window", () => {
    const args = ["--pack", "ai-news", "--view", "daily-brief"];
    expect(() => parseRunArgs(args)).toThrow("--window is required");
  });
});

describe("validateRunArgs", () => {
  test("validates view against builtin views", () => {
    expect(() => validateRunArgs({ packIds: ["test"], viewId: "json", window: "24h" })).not.toThrow();
    expect(() => validateRunArgs({ packIds: ["test"], viewId: "daily-brief", window: "24h" })).not.toThrow();
    expect(() => validateRunArgs({ packIds: ["test"], viewId: "unknown", window: "24h" })).toThrow("Unknown view: unknown");
  });

  test("validates window format", () => {
    expect(() => validateRunArgs({ packIds: ["test"], viewId: "json", window: "24h" })).not.toThrow();
    expect(() => validateRunArgs({ packIds: ["test"], viewId: "json", window: "7d" })).not.toThrow();
    expect(() => validateRunArgs({ packIds: ["test"], viewId: "json", window: "all" })).not.toThrow();
    expect(() => validateRunArgs({ packIds: ["test"], viewId: "json", window: "invalid" })).toThrow("Invalid window format");
  });
});
