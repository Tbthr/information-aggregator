import { describe, expect, test } from "bun:test";
import { runDailyAssertions } from "./verify-daily";

describe("runDailyAssertions", () => {
  test("returns an array of DiagnosticsAssertion", async () => {
    const assertions = await runDailyAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
      dailyOnly: false,
      weeklyOnly: false,
      timeout: 300,
      pollInterval: 3,
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

  test("returns D-17 Empty daily API assertion", async () => {
    const assertions = await runDailyAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
      dailyOnly: false,
      weeklyOnly: false,
      timeout: 300,
      pollInterval: 3,
    });

    const d17 = assertions.find((a) => a.id === "D-17");
    expect(d17).toBeDefined();
    expect(d17?.category).toBe("api");
  });

  test("returns G-05 Daily latest assertion", async () => {
    const assertions = await runDailyAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
      dailyOnly: false,
      weeklyOnly: false,
      timeout: 300,
      pollInterval: 3,
    });

    const g05 = assertions.find((a) => a.id === "G-05");
    expect(g05).toBeDefined();
    expect(g05?.category).toBe("api");
  });
});
