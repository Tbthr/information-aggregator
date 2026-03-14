export interface ParsedCliArgs {
  command:
    | "run"
    | "sources list"
    | "config validate"
    | "auth check"
    | "auth status"
    | "archive collect"
    | "archive stats"
    | "serve"
    | "help"
    | "version";
  authType?: string;
  packIds?: string[];
  port?: number;
  dbPath?: string;
}

export function getCliVersion(): string {
  return "0.2.0";
}

export function getHelpText(): string {
  return [
    "information-aggregator",
    "",
    "Commands:",
    "  run --view <view>          Run a query view",
    "  sources list               List sources matching selectors",
    "  config validate            Validate local config files",
    "  auth check                 Check auth configuration for a type",
    "  auth status                Show all auth configurations",
    "",
    "  archive collect [packs...] Collect and archive items",
    "    --db <path>              Database path (default: data/archive.db)",
    "  archive stats              Show archive statistics",
    "",
    "  serve                      Start API server",
    "    --port <port>            Port number (default: 3000)",
    "    --db <path>              Database path (default: data/archive.db)",
    "",
    "  --help                     Show this help",
    "  --version                  Show version",
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

  // archive collect [packs...] [--db path]
  if (args[0] === "archive" && args[1] === "collect") {
    const rest = args.slice(2);
    const dbIndex = rest.indexOf("--db");
    const dbPath = dbIndex !== -1 ? rest[dbIndex + 1] : undefined;
    const packIds = rest.filter((a, i) => a !== "--db" && (dbIndex === -1 || i !== dbIndex + 1));
    return { command: "archive collect", packIds, dbPath };
  }

  // archive stats [--db path]
  if (args[0] === "archive" && args[1] === "stats") {
    const rest = args.slice(2);
    const dbIndex = rest.indexOf("--db");
    const dbPath = dbIndex !== -1 ? rest[dbIndex + 1] : undefined;
    return { command: "archive stats", dbPath };
  }

  // serve [--port port] [--db path]
  if (args[0] === "serve") {
    const rest = args.slice(1);
    const portIndex = rest.indexOf("--port");
    const dbIndex = rest.indexOf("--db");
    const port = portIndex !== -1 ? parseInt(rest[portIndex + 1], 10) : undefined;
    const dbPath = dbIndex !== -1 ? rest[dbIndex + 1] : undefined;
    return { command: "serve", port, dbPath };
  }

  return { command: "help" };
}
