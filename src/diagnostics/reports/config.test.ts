import { describe, expect, test } from "bun:test";
import { runReportsConfigAssertions } from "./config";

describe("runReportsConfigAssertions", () => {
  test("returns an array of DiagnosticsAssertion", async () => {
    const assertions = await runReportsConfigAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
    });

    expect(Array.isArray(assertions)).toBe(true);
    for (const a of assertions) {
      expect(typeof a.id).toBe("string");
      expect(["PASS", "FAIL", "WARN", "SKIP"]).toContain(a.status);
      expect(typeof a.message).toBe("string");
      expect(typeof a.blocking).toBe("boolean");
      expect(["collection", "reports", "system", "api"]).toContain(a.category);
    }
  });

  test("returns B-04 Config validation assertions", async () => {
    const assertions = await runReportsConfigAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
    });

    const b04 = assertions.find((a) => a.id === "B-04");
    expect(b04).toBeDefined();
    expect(b04?.category).toBe("api");
  });

  test("returns B-05 Weekly days validation assertions", async () => {
    const assertions = await runReportsConfigAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
    });

    const b05 = assertions.find((a) => a.id === "B-05");
    expect(b05).toBeDefined();
    expect(b05?.category).toBe("api");
  });

  test("returns B-06 Malformed body assertions", async () => {
    const assertions = await runReportsConfigAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
    });

    const b06 = assertions.find((a) => a.id === "B-06");
    expect(b06).toBeDefined();
    expect(b06?.category).toBe("api");
  });

  test("returns B-08 Nullable prompts assertions", async () => {
    const assertions = await runReportsConfigAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
    });

    const b08 = assertions.find((a) => a.id === "B-08");
    expect(b08).toBeDefined();
    expect(b08?.category).toBe("api");
  });
});
