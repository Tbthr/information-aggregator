export interface ParsedCliArgs {
  command: "run" | "sources list" | "config validate" | "auth check" | "auth status" | "help" | "version";
  authType?: string;
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
    "  auth check        Check auth configuration for a type",
    "  auth status       Show all auth configurations",
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

  if (args[0] === "auth" && args[1] === "check") {
    return { command: "auth check", authType: args[2] };
  }

  if (args[0] === "auth" && args[1] === "status") {
    return { command: "auth status" };
  }

  return { command: "help" };
}
