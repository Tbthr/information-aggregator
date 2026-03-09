import { describe, expect, test } from "bun:test";
import { runScan } from "./run-scan";

describe("runScan", () => {
  test("returns markdown output for scan mode", async () => {
    const result = await runScan(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        collectSources: async () => [],
      },
    );
    expect(typeof result.markdown).toBe("string");
  });
});
