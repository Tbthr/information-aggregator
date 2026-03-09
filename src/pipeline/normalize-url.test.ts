import { describe, expect, test } from "bun:test";
import { normalizeUrl } from "./normalize-url";

describe("normalizeUrl", () => {
  test("removes tracking parameters", () => {
    expect(normalizeUrl("https://example.com/post?utm_source=x&ref=test&id=1")).toBe("https://example.com/post?id=1");
  });
});
