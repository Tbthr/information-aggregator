import { describe, expect, test } from "bun:test";
import { createAiClient } from "./client";

describe("createAiClient", () => {
  test("returns null when no provider config exists", () => {
    expect(createAiClient({})).toBeNull();
  });
});
