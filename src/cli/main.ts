import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { loadAllPacksFromDb } from "../config/load-pack-prisma";
import { checkAuthConfig, showAuthStatus } from "./auth-commands";
import { getCliVersion, getHelpText, parseCliArgs } from "./index";
import { archiveCollectCommand, archiveStatsCommand } from "./commands/archive";
import { dailyGenerateCommand } from "./commands/daily";
import { weeklyGenerateCommand } from "./commands/weekly";
import { serveCommand } from "./commands/serve";

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.command === "version") {
    console.log(getCliVersion());
    return;
  }

  if (parsed.command === "sources list") {
    const packs = await loadAllPacksFromDb();

    console.log(`Found ${packs.length} packs in database:`);
    for (const pack of packs) {
      console.log(`\n[${pack.id}] ${pack.name}`);
      if (pack.description) {
        console.log(`  ${pack.description}`);
      }
      console.log(`  Sources: ${pack.sources.filter((s) => s.enabled !== false).length}`);
    }
    return;
  }

  if (parsed.command === "config validate") {
    const packs = await loadAllPacksFromDb();
    console.log(`Config validation passed: ${packs.length} packs loaded from database`);
    return;
  }

  if (parsed.command === "auth check") {
    const authType = parsed.authType ?? "x-family";
    const success = await checkAuthConfig(authType);
    process.exit(success ? 0 : 1);
  }

  if (parsed.command === "auth status") {
    await showAuthStatus();
    return;
  }

  if (parsed.command === "archive collect") {
    await archiveCollectCommand(parsed.packIds ?? [], {
      enrichMode: parsed.enrichMode ?? "new",
    });
    return;
  }

  if (parsed.command === "archive stats") {
    await archiveStatsCommand();
    return;
  }

  if (parsed.command === "daily generate") {
    await dailyGenerateCommand(parsed.date);
    return;
  }

  if (parsed.command === "weekly generate") {
    await weeklyGenerateCommand(parsed.date);
    return;
  }

  if (parsed.command === "serve") {
    await serveCommand({
      port: parsed.port,
    });
    return;
  }

  console.log(`information-aggregator ${getCliVersion()}\n`);
  console.log(getHelpText());
}

await main();
