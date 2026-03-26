import { describe, expect, test } from "bun:test";
import { runIntegrityAssertions } from "./verify-integrity";

describe("runIntegrityAssertions", () => {
  test("returns an array of DiagnosticsAssertion", async () => {
    const assertions = await runIntegrityAssertions({
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

  test("returns F-01 DigestTopic FK assertion", async () => {
    const assertions = await runIntegrityAssertions({ apiUrl: "http://localhost:3000", verbose: false });
    const f01 = assertions.find((a) => a.id === "F-01");
    expect(f01).toBeDefined();
    expect(f01?.category).toBe("reports");
  });

  test("returns F-03 WeeklyPick FK assertion", async () => {
    const assertions = await runIntegrityAssertions({ apiUrl: "http://localhost:3000", verbose: false });
    const f03 = assertions.find((a) => a.id === "F-03");
    expect(f03).toBeDefined();
    expect(f03?.category).toBe("reports");
  });

  test("returns F-04 topicCount accuracy assertion", async () => {
    const assertions = await runIntegrityAssertions({ apiUrl: "http://localhost:3000", verbose: false });
    const f04 = assertions.find((a) => a.id === "F-04");
    expect(f04).toBeDefined();
    expect(f04?.category).toBe("reports");
  });

  test("returns F-05 Weekly item source assertion", async () => {
    const assertions = await runIntegrityAssertions({ apiUrl: "http://localhost:3000", verbose: false });
    const f05 = assertions.find((a) => a.id === "F-05");
    expect(f05).toBeDefined();
    expect(f05?.category).toBe("reports");
  });

  test("returns F-06 Item fields assertion", async () => {
    const assertions = await runIntegrityAssertions({ apiUrl: "http://localhost:3000", verbose: false });
    const f06 = assertions.find((a) => a.id === "F-06");
    expect(f06).toBeDefined();
    expect(f06?.category).toBe("reports");
  });

  test("returns F-07 Tweet fields assertion", async () => {
    const assertions = await runIntegrityAssertions({ apiUrl: "http://localhost:3000", verbose: false });
    const f07 = assertions.find((a) => a.id === "F-07");
    expect(f07).toBeDefined();
    expect(f07?.category).toBe("reports");
  });
});
