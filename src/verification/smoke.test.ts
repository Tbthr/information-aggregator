import { describe, expect, test } from "bun:test";
import { getSmokeCommands } from "./smoke";

describe("getSmokeCommands", () => {
  test("returns the recommended verification sequence", () => {
    expect(getSmokeCommands()).toEqual([
      "bun test",
      "bun run check",
      "bun src/cli/main.ts --help",
      "bun src/cli/main.ts config validate",
    ]);
  });
});

// Note: Pack loading test removed as it now requires database connection.
// Use CLI command `bun src/cli/main.ts config validate` for runtime validation.
