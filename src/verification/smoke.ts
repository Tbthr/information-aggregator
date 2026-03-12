export function getSmokeCommands(): string[] {
  return [
    "bun test",
    "bun run check",
    "bun scripts/aggregator.ts --help",
    "bun scripts/aggregator.ts config validate",
    "bun scripts/aggregator.ts run --pack test_daily --view daily-brief --window 24h",
    "bun scripts/aggregator.ts run --pack test_x_analysis --view x-analysis --window all",
    "bun scripts/aggregator.ts sources list --pack test_daily",
    "bun scripts/aggregator.ts sources list --pack test_x_analysis"
  ];
}
