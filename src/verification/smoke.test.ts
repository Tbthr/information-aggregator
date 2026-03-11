import { describe, expect, test } from "bun:test";
import { getSmokeCommands } from "./smoke";
import { loadAllPacksV2 } from "../config/load-pack-v2";

describe("getSmokeCommands", () => {
  test("returns the recommended verification sequence", () => {
    expect(getSmokeCommands()).toEqual([
      "bun test",
      "bun run check",
      "bun scripts/aggregator.ts --help",
      "bun scripts/aggregator.ts config validate",
      "bun scripts/aggregator.ts run --view item-list",
      "bun scripts/aggregator.ts run --view daily-brief",
      "bun scripts/aggregator.ts run --view item-list --format json",
      "bun scripts/aggregator.ts sources list",
    ]);
  });
});

test("smokeV2 loads and validates pack files", async () => {
  const packs = await loadAllPacksV2("config/packs-v2");
  expect(packs.length).toBeGreaterThan(0);

  for (const pack of packs) {
    expect(pack.id).toBeDefined();
    expect(pack.name).toBeDefined();
    expect(pack.sources.length).toBeGreaterThan(0);
  }
});
