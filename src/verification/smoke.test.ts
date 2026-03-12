import { describe, expect, test } from "bun:test";
import { getSmokeCommands } from "./smoke";
import { loadAllPacks } from "../config/load-pack";

describe("getSmokeCommands", () => {
  test("returns the recommended verification sequence", () => {
    expect(getSmokeCommands()).toEqual([
      "bun test",
      "bun run check",
      "bun scripts/aggregator.ts --help",
      "bun scripts/aggregator.ts config validate",
      "bun scripts/aggregator.ts run --pack dev-tools --view item-list --window 24h",
      "bun scripts/aggregator.ts run --pack dev-tools --view daily-brief --window 24h",
      "bun scripts/aggregator.ts sources list --pack dev-tools",
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
