export interface ParsedCliArgs {
  command: "scan" | "digest" | "config validate" | "help" | "version";
}

export function getCliVersion(): string {
  return "0.1.0";
}

export function getHelpText(): string {
  return [
    "information-aggregator",
    "",
    "Commands:",
    "  scan             Run scan mode",
    "  digest           Run digest mode",
    "  config validate  Validate local config files",
    "  --help           Show this help",
    "  --version        Show version",
  ].join("\n");
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  if (args.includes("--version")) {
    return { command: "version" };
  }

  if (args[0] === "scan") {
    return { command: "scan" };
  }

  if (args[0] === "digest") {
    return { command: "digest" };
  }

  if (args[0] === "config" && args[1] === "validate") {
    return { command: "config validate" };
  }

  return { command: "help" };
}
