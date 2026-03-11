export interface ParsedCliArgs {
  command: "run" | "sources list" | "config validate" | "help" | "version";
}

export function getCliVersion(): string {
  return "0.1.0";
}

export function getHelpText(): string {
  return [
    "information-aggregator",
    "",
    "Commands:",
    "  run --view <view>  Run a query view",
    "  sources list      List sources matching selectors",
    "  config validate  Validate local config files",
    "  --help           Show this help",
    "  --version        Show version",
  ].join("\n");
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  if (args.includes("--version")) {
    return { command: "version" };
  }

  if (args[0] === "run") {
    return { command: "run" };
  }

  if (args[0] === "sources" && args[1] === "list") {
    return { command: "sources list" };
  }

  if (args[0] === "config" && args[1] === "validate") {
    return { command: "config validate" };
  }

  return { command: "help" };
}
