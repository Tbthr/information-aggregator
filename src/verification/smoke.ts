export function getSmokeCommands(): string[] {
  return [
    "bun test",
    "bun run check",
    "bun scripts/aggregator.ts --help",
    "bun scripts/aggregator.ts config validate",
    "bun scripts/aggregator.ts run --pack _test --view item-list --window 24h",
    "bun scripts/aggregator.ts run --pack _test --view daily-brief --window 24h",
    "bun scripts/aggregator.ts sources list --pack _test",
  ];
}
