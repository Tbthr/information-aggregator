import { describe, expect, test } from "bun:test";
import { runWeeklyAssertions } from "./verify-weekly";

describe("runWeeklyAssertions", () => {
  // Use dailyOnly to skip Stage 7+8 (which trigger actual weekly generation and poll)
  // so structural checks (E-10, G-06) can be verified without a running server or long timeouts.
  const baseOptions = {
    apiUrl: "http://localhost:3000",
    verbose: false,
    dailyOnly: true, // skip heavy Stage 7/8
    weeklyOnly: false,
    timeout: 300,
    pollInterval: 3,
  };

  test("returns an array of DiagnosticsAssertion", async () => {
    const assertions = await runWeeklyAssertions(baseOptions);

    expect(Array.isArray(assertions)).toBe(true);
    for (const a of assertions) {
      expect(typeof a.id).toBe("string");
      expect(["PASS", "FAIL", "WARN", "SKIP"]).toContain(a.status);
      expect(typeof a.message).toBe("string");
      expect(typeof a.blocking).toBe("boolean");
      expect(["collection", "reports", "system", "api"]).toContain(a.category);
    }
  });

  test("returns E-10 Empty weekly API assertion", async () => {
    const assertions = await runWeeklyAssertions(baseOptions);

    const e10 = assertions.find((a) => a.id === "E-10");
    expect(e10).toBeDefined();
    expect(e10?.category).toBe("api");
  });

  test("returns G-06 Weekly latest assertion", async () => {
    const assertions = await runWeeklyAssertions(baseOptions);

    const g06 = assertions.find((a) => a.id === "G-06");
    expect(g06).toBeDefined();
    expect(g06?.category).toBe("api");
  });

  test("skips Stage 7/8 when dailyOnly is true", async () => {
    const assertions = await runWeeklyAssertions(baseOptions);

    const stage7 = assertions.find((a) => a.id === "reports.stage7");
    const stage8 = assertions.find((a) => a.id === "reports.stage8");
    expect(stage7).toBeUndefined();
    expect(stage8).toBeUndefined();
  });
});

describe("runWeeklyAssertions (integration, requires running server)", () => {
  test("triggers weekly generation and verifies output", async () => {
    const assertions = await runWeeklyAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
      dailyOnly: false,
      weeklyOnly: false,
      timeout: 300,
      pollInterval: 3,
    });

    // Should include stage7 and stage8 assertions
    const stage7 = assertions.find((a) => a.id === "reports.stage7");
    const stage8 = assertions.find((a) => a.id === "reports.stage8");
    expect(stage7).toBeDefined();
    expect(stage8).toBeDefined();

    // Structural assertions
    for (const a of [stage7!, stage8!]) {
      expect(["PASS", "FAIL", "SKIP"]).toContain(a.status);
      expect(typeof a.message).toBe("string");
      expect(typeof a.blocking).toBe("boolean");
    }
  }, 600000); // 10 min timeout for integration test
});
