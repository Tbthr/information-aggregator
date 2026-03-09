export function getSmokeCommands(): string[] {
  return [
    "bun test",
    "bun run check",
    "bun scripts/aggregator.ts --help",
    "bun scripts/aggregator.ts config validate",
    "bun scripts/aggregator.ts scan",
    "bun scripts/aggregator.ts digest",
  ];
}
