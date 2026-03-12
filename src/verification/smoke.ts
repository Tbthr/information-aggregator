export function getSmokeCommands(): string[] {
  return [
    "bun test",
    "bun run check",
    "bun src/cli/main.ts --help",
    "bun src/cli/main.ts config validate",
    "bun src/cli/main.ts run --pack test_daily --view daily-brief --window 24h",
    "bun src/cli/main.ts run --pack test_x_analysis --view x-analysis --window all",
    "bun src/cli/main.ts sources list --pack test_daily",
    "bun src/cli/main.ts sources list --pack test_x_analysis",
  ];
}
