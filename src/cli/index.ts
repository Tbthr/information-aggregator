export interface ParsedCliArgs {
  command:
    | "sources list"
    | "config validate"
    | "auth check"
    | "auth status"
    | "archive collect"
    | "archive stats"
    | "daily generate"
    | "weekly generate"
    | "serve"
    | "help"
    | "version";
  authType?: string;
  packIds?: string[];
  port?: number;
  dbPath?: string;
  date?: string;
  enrichMode?: "new" | "backfill" | "force";
}

export function getCliVersion(): string {
  return "0.3.0";
}

export function getHelpText(): string {
  return [
    "information-aggregator",
    "",
    "Commands:",
    "  sources list               List sources matching selectors",
    "  config validate            Validate local config files",
    "  auth check                 Check auth configuration for a type",
    "  auth status                Show all auth configurations",
    "",
    "  archive collect [packs...] Collect and archive items with AI enrichment",
    "    --backfill               Backfill historical items with null fields",
    "    --force                  Force re-enrich all items",
    "  archive stats              Show archive statistics",
    "",
    "  daily generate [--date]    Generate daily report (default: today)",
    "  weekly generate [--date]   Generate weekly report (default: this week)",
    "",
    "  serve                      Start API server",
    "    --port <port>            Port number (default: 3000)",
    "",
    "  --help                     Show this help",
    "  --version                  Show version",
  ].join("\n");
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  if (args.includes("--version")) {
    return { command: "version" };
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

  // archive collect [packs...] [--backfill] [--force]
  if (args[0] === "archive" && args[1] === "collect") {
    const rest = args.slice(2);
    const backfill = rest.includes("--backfill");
    const force = rest.includes("--force");
    const enrichMode: "new" | "backfill" | "force" = force ? "force" : backfill ? "backfill" : "new";

    const packIds = rest.filter((a) => a !== "--backfill" && a !== "--force");
    return { command: "archive collect", packIds, enrichMode };
  }

  // archive stats
  if (args[0] === "archive" && args[1] === "stats") {
    return { command: "archive stats" };
  }

  // daily generate [--date YYYY-MM-DD]
  if (args[0] === "daily" && args[1] === "generate") {
    const rest = args.slice(2);
    const dateIndex = rest.indexOf("--date");
    const date = dateIndex !== -1 ? rest[dateIndex + 1] : undefined;
    return { command: "daily generate", date };
  }

  // weekly generate [--date YYYY-MM-DD]
  if (args[0] === "weekly" && args[1] === "generate") {
    const rest = args.slice(2);
    const dateIndex = rest.indexOf("--date");
    const date = dateIndex !== -1 ? rest[dateIndex + 1] : undefined;
    return { command: "weekly generate", date };
  }

  // serve [--port port]
  if (args[0] === "serve") {
    const rest = args.slice(1);
    const portIndex = rest.indexOf("--port");
    const port = portIndex !== -1 ? parseInt(rest[portIndex + 1], 10) : undefined;
    return { command: "serve", port };
  }

  return { command: "help" };
}
