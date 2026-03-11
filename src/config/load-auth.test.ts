import { describe, expect, test } from "bun:test";
import { validateAuthConfig, getAuthFileForSourceType } from "./load-auth";

describe("validateAuthConfig", () => {
  test("validates required fields", () => {
    const input = {
      adapter: "x_family",
      config: { chromeProfile: "Default" },
    };
    const result = validateAuthConfig(input);
    expect(result.adapter).toBe("x_family");
    expect(result.config).toEqual({ chromeProfile: "Default" });
  });

  test("throws on missing adapter", () => {
    expect(() => validateAuthConfig({ config: {} })).toThrow();
  });

  test("throws on missing config", () => {
    expect(() => validateAuthConfig({ adapter: "test" })).toThrow();
  });
});

describe("getAuthFileForSourceType", () => {
  test("returns x-family for x_home", () => {
    expect(getAuthFileForSourceType("x_home")).toBe("x-family");
  });

  test("returns x-family for x_list", () => {
    expect(getAuthFileForSourceType("x_list")).toBe("x-family");
  });

  test("returns x-family for x_bookmarks", () => {
    expect(getAuthFileForSourceType("x_bookmarks")).toBe("x-family");
  });

  test("returns undefined for rss", () => {
    expect(getAuthFileForSourceType("rss")).toBeUndefined();
  });

  test("returns undefined for website", () => {
    expect(getAuthFileForSourceType("website")).toBeUndefined();
  });
});
