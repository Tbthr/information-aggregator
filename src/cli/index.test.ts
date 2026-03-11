import { describe, expect, test } from "bun:test";
import { getCliVersion, getHelpText, parseCliArgs } from "./index";

describe("cli bootstrap", () => {
  test("returns a version string", () => {
    expect(getCliVersion()).toBe("0.1.0");
  });

  test("only advertises supported commands", () => {
    const help = getHelpText();
    expect(help).toContain("run --view <view>");
    expect(help).toContain("sources list");
    expect(help).toContain("config validate");
    expect(help).not.toContain("scan");
    expect(help).not.toContain("digest");
  });

  test("parses supported commands and rejects removed legacy commands", () => {
    expect(parseCliArgs(["run", "--view", "daily-brief"]).command).toBe("run");
    expect(parseCliArgs(["sources", "list"]).command).toBe("sources list");
    expect(parseCliArgs(["config", "validate"]).command).toBe("config validate");
    expect(parseCliArgs(["scan"]).command).toBe("help");
    expect(parseCliArgs(["digest"]).command).toBe("help");
  });
});
