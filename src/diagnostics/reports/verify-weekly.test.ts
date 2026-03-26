import { describe, expect, test } from "bun:test";
import { runWeeklyAssertions } from "./verify-weekly";

describe("runWeeklyAssertions", () => {
  test("returns an array of DiagnosticsAssertion", async () => {
    const assertions = await runWeeklyAssertions({
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

  test("returns E-10 Empty weekly API assertion", async () => {
    const assertions = await runWeeklyAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
      dailyOnly: false,
      weeklyOnly: false,
      timeout: 300,
      pollInterval: 3,
    });

    const e10 = assertions.find((a) => a.id === "E-10");
    expect(e10).toBeDefined();
    expect(e10?.category).toBe("api");
  });

  test("returns G-06 Weekly latest assertion", async () => {
    const assertions = await runWeeklyAssertions({
      apiUrl: "http://localhost:3000",
      verbose: false,
      dailyOnly: false,
      weeklyOnly: false,
      timeout: 300,
      pollInterval: 3,
    });

    const g06 = assertions.find((a) => a.id === "G-06");
    expect(g06).toBeDefined();
    expect(g06?.category).toBe("api");
  });
});
