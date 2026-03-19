import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { loadAllPacks } from "../config/load-pack";
import { checkAuthConfig, showAuthStatus } from "./auth-commands";
import { getCliVersion, getHelpText, parseCliArgs } from "./index";
import { archiveCollectCommand, archiveStatsCommand } from "./commands/archive";
import { serveCommand } from "./commands/serve";

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.command === "version") {
    console.log(getCliVersion());
    return;
  }

  if (parsed.command === "sources list") {
    const packFiles = (await readdir(resolve(process.cwd(), "config/packs")))
      .filter((fileName) => fileName.endsWith(".yaml"))
      .sort();

    const packs = await loadAllPacks("config/packs");

    console.log(`Found ${packs.length} packs with ${packFiles.length} files:`);
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
    const packs = await loadAllPacks("config/packs");
    console.log(`Config validation passed: ${packs.length} packs loaded`);
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
    await archiveCollectCommand(parsed.packIds ?? []);
    return;
  }

  if (parsed.command === "archive stats") {
    await archiveStatsCommand();
    return;
  }

  if (parsed.command === "serve") {
    await serveCommand({
      port: parsed.port,
      dbPath: parsed.dbPath,
    });
    return;
  }

  console.log(`information-aggregator ${getCliVersion()}\n`);
  console.log(getHelpText());
}

await main();
