export function getSmokeCommands(): string[] {
  return [
    "bun test",
    "bun run check",
    "bun src/cli/main.ts --help",
    "bun src/cli/main.ts config validate",
  ];
}
