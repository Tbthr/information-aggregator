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
    await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      loadTopicsConfig("config/topics.example.yaml"),
      loadProfilesConfig("config/profiles.example.yaml"),
      loadSourcePacksConfig("config/packs/ai-news-sites.yaml"),
      loadSourcePacksConfig("config/packs/ai-daily-digest-blogs.yaml"),
    ]);
    console.log("Config validation passed");
    return;
  }

  console.log(`information-aggregator ${getCliVersion()}\n`);
  console.log(getHelpText());
}

await main();
