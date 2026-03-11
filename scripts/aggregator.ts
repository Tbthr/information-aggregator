import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { loadProfilesConfig, loadSourcePacksConfig, loadSourcesConfig, loadTopicsConfig, loadViewsConfig } from "../src/config/load";
import { getCliVersion, getHelpText, parseCliArgs } from "../src/cli/index";
import { parseQueryCliArgs } from "../src/query/parse-cli";
import { resolveSelection } from "../src/query/resolve-selection";
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
    const query = parseQueryCliArgs(process.argv.slice(2));
    const queryResult = await runQuery(query);
    const viewId = queryResult.selection.view.id;
    const viewModel = buildViewModel(queryResult, viewId);
    console.log(
      query.format === "json"
        ? renderQueryJson({ queryResult, viewModel })
        : renderViewMarkdown(viewModel, viewId),
    );
    return;
  }

  if (parsed.command === "sources list") {
    const [sources, profiles, views, packFiles] = await Promise.all([
      loadSourcesConfig("config/sources.example.yaml"),
      loadProfilesConfig("config/profiles.example.yaml"),
      loadViewsConfig("config/views.example.yaml"),
      readdir(resolve(process.cwd(), "config/packs")),
    ]);
    const sourcePacks = (await Promise.all(
      packFiles
        .filter((fileName) => fileName.endsWith(".yaml"))
        .sort()
        .map((fileName) => loadSourcePacksConfig(`config/packs/${fileName}`)),
    )).flat();
    const selection = resolveSelection({
      query: parseQueryCliArgs(process.argv.slice(2)),
      profiles,
      sourcePacks,
      sources,
      views,
    });
    console.log(selection.sources.map((source) => `${source.id}\t${source.type}\t${source.name}`).join("\n"));
    return;
  }

  if (parsed.command === "config validate") {
    const packFiles = (await readdir(resolve(process.cwd(), "config/packs")))
      .filter((fileName) => fileName.endsWith(".yaml"))
      .sort();

    await Promise.all([
      loadSourcesConfig("config/sources.example.yaml", { includeDisabled: true }),
      loadTopicsConfig("config/topics.example.yaml"),
      loadProfilesConfig("config/profiles.example.yaml"),
      loadViewsConfig("config/views.example.yaml"),
      ...packFiles.map((fileName) => loadSourcePacksConfig(`config/packs/${fileName}`)),
    ]);
    console.log("Config validation passed");
    return;
  }

  console.log(`information-aggregator ${getCliVersion()}\n`);
  console.log(getHelpText());
}

await main();
