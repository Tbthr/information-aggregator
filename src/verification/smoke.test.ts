import { describe, expect, test } from "bun:test";
import { getSmokeCommands } from "./smoke";
import { loadAllPacks } from "../config/load-pack";

describe("getSmokeCommands", () => {
  test("returns the recommended verification sequence", () => {
    expect(getSmokeCommands()).toEqual([
      "bun test",
      "bun run check",
      "bun src/cli/main.ts --help",
      "bun src/cli/main.ts config validate",
      "bun src/cli/main.ts run --pack test_daily --view daily-brief --window 24h",
      "bun src/cli/main.ts run --pack test_x_analysis --view x-analysis --window all",
      "bun src/cli/main.ts sources list --pack test_daily",
      "bun src/cli/main.ts sources list --pack test_x_analysis",
    ]);
  });
});

test("smoke loads and validates pack files", async () => {
  const packs = await loadAllPacks("config/packs");
  expect(packs.length).toBeGreaterThan(0);

  for (const pack of packs) {
    expect(pack.id).toBeDefined();
    expect(pack.name).toBeDefined();
    expect(pack.sources.length).toBeGreaterThanOrEqual(0);
  }
});
