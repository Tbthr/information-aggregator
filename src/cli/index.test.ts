import { describe, expect, test } from "bun:test";
import { getCliVersion } from "./index";

describe("cli bootstrap", () => {
  test("returns a version string", () => {
    expect(getCliVersion()).toBe("0.1.0");
  });
});
