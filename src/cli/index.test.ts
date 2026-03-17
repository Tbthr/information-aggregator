import { describe, expect, test } from "bun:test";
import { getCliVersion, getHelpText, parseCliArgs } from "./index";

describe("cli bootstrap", () => {
  test("returns a version string", () => {
    expect(getCliVersion()).toBe("0.2.0");
  });

  test("only advertises supported commands", () => {
    const help = getHelpText();
    expect(help).toContain("sources list");
    expect(help).toContain("config validate");
    expect(help).toContain("serve");
    expect(help).not.toContain("scan");
    expect(help).not.toContain("digest");
    expect(help).not.toContain("run --view");
  });

  test("parses supported commands and rejects removed legacy commands", () => {
    expect(parseCliArgs(["sources", "list"]).command).toBe("sources list");
    expect(parseCliArgs(["config", "validate"]).command).toBe("config validate");
    expect(parseCliArgs(["serve"]).command).toBe("serve");
    expect(parseCliArgs(["scan"]).command).toBe("help");
    expect(parseCliArgs(["digest"]).command).toBe("help");
    expect(parseCliArgs(["run", "--view", "daily-brief"]).command).toBe("help");
  });
});
