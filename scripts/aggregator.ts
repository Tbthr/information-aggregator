import { getCliVersion } from "../src/cli/index";

function main(): void {
  const arg = process.argv[2];

  if (arg === "--version") {
    console.log(getCliVersion());
    return;
  }

  console.log(`information-aggregator ${getCliVersion()}`);
  console.log("Usage: bun scripts/aggregator.ts --version");
}

main();
