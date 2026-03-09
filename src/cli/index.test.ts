import { describe, expect, test } from "bun:test";
import { getCliVersion, getHelpText } from "./index";

describe("cli bootstrap", () => {
  test("returns a version string", () => {
    expect(getCliVersion()).toBe("0.1.0");
  });

  test("mentions scan and digest commands", () => {
    const help = getHelpText();
    expect(help).toContain("scan");
    expect(help).toContain("digest");
  });
});
