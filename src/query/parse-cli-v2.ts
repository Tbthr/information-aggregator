import { BUILTIN_VIEWS } from "../types/index";
import type { ParsedRunArgsV2 } from "../types/index";

export function parseRunArgsV2(args: string[]): ParsedRunArgsV2 {
  const result: Partial<ParsedRunArgsV2> = {};

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

  return result as ParsedRunArgsV2;
}

export function validateRunArgsV2(args: ParsedRunArgsV2): void {
  if (!BUILTIN_VIEWS.has(args.viewId)) {
    throw new Error(`Unknown view: ${args.viewId}. Valid views: ${[...BUILTIN_VIEWS].join(", ")}`);
  }

  if (args.window !== "all" && !/^\d+[hd]$/.test(args.window)) {
    throw new Error(`Invalid window format: ${args.window}. Expected: <number><h|d> or "all"`);
  }
}
