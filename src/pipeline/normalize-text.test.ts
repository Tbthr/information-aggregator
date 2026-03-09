import { describe, expect, test } from "bun:test";
import { normalizeTitle } from "./normalize-text";

describe("normalizeTitle", () => {
  test("collapses whitespace and lowercases text", () => {
    expect(normalizeTitle("  Hello   World  ")).toBe("hello world");
  });
});
