export function getSmokeCommands(): string[] {
  return [
    "bun test",
    "bun run check",
    "bun scripts/aggregator.ts --help",
    "bun scripts/aggregator.ts config validate",
    "bun scripts/aggregator.ts run --view item-list",
    "bun scripts/aggregator.ts run --view daily-brief",
    "bun scripts/aggregator.ts run --view item-list --format json",
    "bun scripts/aggregator.ts sources list",
  ];
}
