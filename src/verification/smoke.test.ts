import { describe, expect, test } from "bun:test";
import { getSmokeCommands } from "./smoke";

describe("getSmokeCommands", () => {
  test("returns the recommended verification sequence", () => {
    expect(getSmokeCommands()).toEqual([
      "bun test",
      "bun run check",
      "bun scripts/aggregator.ts --help",
      "bun scripts/aggregator.ts config validate",
      "bun scripts/aggregator.ts run --view item-list",
      "bun scripts/aggregator.ts run --view daily-brief",
    ]);
  });
});
