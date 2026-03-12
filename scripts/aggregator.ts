import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAnthropicClient } from "../src/ai/client";
import { loadAllPacks } from "../src/config/load-pack";
import { checkAuthConfig, showAuthStatus } from "../src/cli/auth-commands";
import { getCliVersion, getHelpText, parseCliArgs } from "../src/cli/index";
import { parseRunArgs, validateRunArgs } from "../src/query/parse-cli";
import { runQuery } from "../src/query/run-query";
import { renderQueryJson } from "../src/render/json";
import { buildViewModel, renderViewMarkdown } from "../src/views/registry";

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.command === "version") {
    console.log(getCliVersion());
    return;
  }

  if (parsed.command === "run") {
    const args = parseRunArgs(process.argv.slice(2));
    validateRunArgs(args);

    // 创建 AI client（除非显式禁用）
    const aiClient = args.noAi ? null : createAnthropicClient();

    const packs = await loadAllPacks("config/packs");
    const queryResult = await runQuery(args, { loadPacks: () => packs, aiClient });

    const viewId = queryResult.args.viewId;
    // 通过依赖注入传递 AI client
    const viewModel = await buildViewModel(queryResult, viewId, { aiClient });

    const output = viewId === "json"
      ? renderQueryJson({ queryResult, viewModel })
      : renderViewMarkdown(viewModel, viewId);

    if (args.outputFile) {
      await writeFile(args.outputFile, output, "utf-8");
      console.log(`Written to ${args.outputFile}`);
    } else {
      console.log(output);
    }
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
    return;
  }

  if (parsed.command === "auth status") {
    await showAuthStatus();
    return;
  }

  console.log(`information-aggregator ${getCliVersion()}\n`);
  console.log(getHelpText());
}

await main();
