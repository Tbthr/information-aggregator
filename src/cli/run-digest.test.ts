import { describe, expect, test } from "bun:test";
import { runDigest } from "./run-digest";

describe("runDigest", () => {
  test("returns markdown output for digest mode", async () => {
    const result = await runDigest(
      {
        profileId: "default",
        dryRun: true,
      },
      {
        collectSources: async () => [],
        buildClusters: () => [],
      },
    );
    expect(typeof result.markdown).toBe("string");
  });
});
