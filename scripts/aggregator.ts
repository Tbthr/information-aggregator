import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig } from "../src/config/load";
import { getCliVersion, getHelpText, parseCliArgs } from "../src/cli/index";
import { runDigest } from "../src/cli/run-digest";
import { runScan } from "../src/cli/run-scan";

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.command === "version") {
    console.log(getCliVersion());
    return;
  }

  if (parsed.command === "scan") {
    const result = await runScan({ profileId: "default", dryRun: true });
    console.log(result.markdown);
    return;
  }

  if (parsed.command === "digest") {
    const result = await runDigest({ profileId: "default", dryRun: true });
    console.log(result.markdown);
    return;
  }

  if (parsed.command === "config validate") {
    const packFiles = (await readdir(resolve(process.cwd(), "config/packs")))
      .filter((fileName) => fileName.endsWith(".yaml"))
      .sort();

    await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      loadTopicsConfig("config/topics.example.yaml"),
      loadProfilesConfig("config/profiles.example.yaml"),
      ...packFiles.map((fileName) => loadSourcePacksConfig(`config/packs/${fileName}`)),
    ]);
    console.log("Config validation passed");
    return;
  }

  console.log(`information-aggregator ${getCliVersion()}\n`);
  console.log(getHelpText());
}

await main();
