import { describe, expect, test } from "bun:test";
import { getCliVersion, getHelpText, parseCliArgs } from "./index";

describe("cli bootstrap", () => {
  test("returns a version string", () => {
    expect(getCliVersion()).toBe("0.1.0");
  });

  test("promotes run and sources list while marking legacy commands deprecated", () => {
    const help = getHelpText();
    expect(help).toContain("run --view <view>");
    expect(help).toContain("sources list");
    expect(help).toContain("scan (deprecated)");
    expect(help).toContain("digest (deprecated)");
  });

  test("parses run, sources list, and config validate commands", () => {
    expect(parseCliArgs(["run", "--view", "daily-brief"]).command).toBe("run");
    expect(parseCliArgs(["sources", "list"]).command).toBe("sources list");
    expect(parseCliArgs(["config", "validate"]).command).toBe("config validate");
  });
});
