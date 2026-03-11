import { BUILTIN_VIEWS } from "../types/index";
import type { ParsedRunArgs } from "../types/index";

export function parseRunArgs(args: string[]): ParsedRunArgs {
  const result: Partial<ParsedRunArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const token = args[i];

    switch (token) {
      case "--pack":
        result.packIds = args[++i]?.split(",") ?? [];
        break;
      case "--view":
        result.viewId = args[++i];
        break;
      case "--window":
        result.window = args[++i];
        break;
      case "--output":
        result.outputFile = args[++i];
        break;
      default:
        if (token?.startsWith("--")) {
          throw new Error(`Unknown argument: ${token}`);
        }
    }
  }

  if (!result.packIds?.length) {
    throw new Error("--pack is required");
  }
  if (!result.viewId) {
    throw new Error("--view is required");
  }
  if (!result.window) {
    throw new Error("--window is required");
  }

  return result as ParsedRunArgs;
}

export function validateRunArgs(args: ParsedRunArgs): void {
  if (!BUILTIN_VIEWS.has(args.viewId)) {
    throw new Error(`Unknown view: ${args.viewId}. Valid views: ${[...BUILTIN_VIEWS].join(", ")}`);
  }

  if (args.window !== "all" && !/^\d+[hd]$/.test(args.window)) {
    throw new Error(`Invalid window format: ${args.window}. Expected: <number><h|d> or "all"`);
  }
}
