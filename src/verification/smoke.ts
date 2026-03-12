export function getSmokeCommands(): string[] {
  return [
    "bun test",
    "bun run check",
    "bun scripts/aggregator.ts --help",
    "bun scripts/aggregator.ts config validate",
    "bun scripts/aggregator.ts run --pack dev-tools --view item-list --window 24h",
    "bun scripts/aggregator.ts run --pack dev-tools --view daily-brief --window 24h",
    "bun scripts/aggregator.ts sources list --pack dev-tools",
  ];
}
