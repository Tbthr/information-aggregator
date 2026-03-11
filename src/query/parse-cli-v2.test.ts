import { describe, expect, test } from "bun:test";
import { parseRunArgsV2, validateRunArgsV2 } from "./parse-cli-v2";

describe("parseRunArgsV2", () => {
  test("parses all required arguments", () => {
    const args = ["--pack", "ai-news", "--view", "daily-brief", "--window", "24h"];
    const result = parseRunArgsV2(args);
    expect(result.packIds).toEqual(["ai-news"]);
    expect(result.viewId).toBe("daily-brief");
    expect(result.window).toBe("24h");
  });

  test("parses multiple packs", () => {
    const args = ["--pack", "ai-news,engineering", "--view", "json", "--window", "7d"];
    const result = parseRunArgsV2(args);
    expect(result.packIds).toEqual(["ai-news", "engineering"]);
  });

  test("throws on unknown argument", () => {
    const args = ["--pack", "ai-news", "--unknown", "value"];
    expect(() => parseRunArgsV2(args)).toThrow("Unknown argument: --unknown");
  });

  test("throws on missing --pack", () => {
    const args = ["--view", "daily-brief", "--window", "24h"];
    expect(() => parseRunArgsV2(args)).toThrow("--pack is required");
  });

  test("throws on missing --view", () => {
    const args = ["--pack", "ai-news", "--window", "24h"];
    expect(() => parseRunArgsV2(args)).toThrow("--view is required");
  });

  test("throws on missing --window", () => {
    const args = ["--pack", "ai-news", "--view", "daily-brief"];
    expect(() => parseRunArgsV2(args)).toThrow("--window is required");
  });
});

describe("validateRunArgsV2", () => {
  test("validates view against builtin views", () => {
    expect(() => validateRunArgsV2({ packIds: ["test"], viewId: "json", window: "24h" })).not.toThrow();
    expect(() => validateRunArgsV2({ packIds: ["test"], viewId: "daily-brief", window: "24h" })).not.toThrow();
    expect(() => validateRunArgsV2({ packIds: ["test"], viewId: "unknown", window: "24h" })).toThrow("Unknown view: unknown");
  });

  test("validates window format", () => {
    expect(() => validateRunArgsV2({ packIds: ["test"], viewId: "json", window: "24h" })).not.toThrow();
    expect(() => validateRunArgsV2({ packIds: ["test"], viewId: "json", window: "7d" })).not.toThrow();
    expect(() => validateRunArgsV2({ packIds: ["test"], viewId: "json", window: "all" })).not.toThrow();
    expect(() => validateRunArgsV2({ packIds: ["test"], viewId: "json", window: "invalid" })).toThrow("Invalid window format");
  });
});
