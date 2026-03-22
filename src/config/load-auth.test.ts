import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mergeAuthConfig, getAuthConfigs, clearAuthConfigCache } from "./load-auth";

describe("mergeAuthConfig", () => {
  test("merges auth config into source config", () => {
    const source = { configJson: '{"birdMode":"home","count":50}' };
    const authConfig = { authToken: "xxx", ct0: "yyy" };
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed).toEqual({
      birdMode: "home",
      count: 50,
      authToken: "xxx",
      ct0: "yyy",
    });
  });

  test("auth config overrides source config", () => {
    const source = { configJson: '{"birdMode":"home","count":50}' };
    const authConfig = { count: 100, authToken: "abc" };
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed.count).toBe(100);
    expect(parsed.birdMode).toBe("home");
  });

  test("handles empty source config", () => {
    const source = { configJson: "{}" };
    const authConfig = { authToken: "xxx" };
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed).toEqual({ authToken: "xxx" });
  });

  test("handles empty auth config", () => {
    const source = { configJson: '{"birdMode":"home"}' };
    const authConfig = {};
    const result = mergeAuthConfig(source, authConfig);

    const parsed = JSON.parse(result.configJson);
    expect(parsed).toEqual({ birdMode: "home" });
  });
});

describe("getAuthConfigs (env-based)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearAuthConfigCache();
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("X_")) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    clearAuthConfigCache();
  });

  test("returns x-family config when both tokens are set", () => {
    process.env.X_AUTH_TOKEN = "test-auth-token";
    process.env.X_CT0 = "test-ct0";

    const configs = getAuthConfigs();
    expect(configs).toEqual({
      "x-family": { authToken: "test-auth-token", ct0: "test-ct0" },
    });
  });

  test("returns empty config when only X_AUTH_TOKEN is set", () => {
    process.env.X_AUTH_TOKEN = "test-auth-token";

    const configs = getAuthConfigs();
    expect(configs).toEqual({});
  });

  test("returns empty config when only X_CT0 is set", () => {
    process.env.X_CT0 = "test-ct0";

    const configs = getAuthConfigs();
    expect(configs).toEqual({});
  });

  test("returns empty config when no env vars are set", () => {
    const configs = getAuthConfigs();
    expect(configs).toEqual({});
  });

  test("caches results", () => {
    process.env.X_AUTH_TOKEN = "cached-token";
    process.env.X_CT0 = "cached-ct0";

    const first = getAuthConfigs();
    process.env.X_AUTH_TOKEN = "modified-token";
    const second = getAuthConfigs();
    expect(first).toBe(second);
  });

  test("clearAuthConfigCache invalidates cache", () => {
    process.env.X_AUTH_TOKEN = "token1";
    process.env.X_CT0 = "ct01";

    const first = getAuthConfigs();
    clearAuthConfigCache();
    process.env.X_AUTH_TOKEN = "token2";
    process.env.X_CT0 = "ct02";

    const second = getAuthConfigs();
    expect(first).not.toBe(second);
    expect(second).toEqual({
      "x-family": { authToken: "token2", ct0: "ct02" },
    });
  });
});
