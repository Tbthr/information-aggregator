import { describe, expect, test } from "bun:test";
import { validateAuthConfig, getAuthFileForSourceType, mergeAuthConfig } from "./load-auth";

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

describe("mergeAuthConfig", () => {
  test("merges auth config into source config", () => {
    const source = { configJson: '{"birdMode":"home","count":50}' };
    const authConfig = { chromeProfile: "Default", cookieSource: "chrome" };
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed).toEqual({
      birdMode: "home",
      count: 50,
      chromeProfile: "Default",
      cookieSource: "chrome",
    });
  });

  test("auth config overrides source config", () => {
    const source = { configJson: '{"birdMode":"home","count":50}' };
    const authConfig = { count: 100, chromeProfile: "Default" };
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed.count).toBe(100); // auth config overrides
    expect(parsed.birdMode).toBe("home");
  });

  test("handles empty source config", () => {
    const source = { configJson: "{}" };
    const authConfig = { chromeProfile: "Default" };
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed).toEqual({ chromeProfile: "Default" });
  });

  test("handles empty auth config", () => {
    const source = { configJson: '{"birdMode":"home"}' };
    const authConfig = {};
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed).toEqual({ birdMode: "home" });
  });
});
