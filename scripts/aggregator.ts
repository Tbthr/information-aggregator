import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createAnthropicClient } from "../src/ai/client";
import { buildTopicSuggestionPrompt } from "../src/ai/prompts";
import { loadAllPacks } from "../src/config/load-pack";
import { getCliVersion, getHelpText, parseCliArgs } from "../src/cli/index";
import { parseRunArgs, validateRunArgs } from "../src/query/parse-cli";
import { runQuery } from "../src/query/run-query";
import { renderQueryJson } from "../src/render/json";
import { buildViewModel, renderViewMarkdown } from "../src/views/registry";
import { type XBookmarksDigestModel, resolveTopicSuggestions } from "../src/views/x-bookmarks-digest";

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
    const viewModel = buildViewModel(queryResult, viewId);

    // 为 x-bookmarks-digest 视图生成选题建议
    if (viewId === "x-bookmarks-digest" && aiClient) {
      const digestModel = viewModel as XBookmarksDigestModel;
      if (digestModel.bookmarkItems && digestModel.bookmarkItems.length > 0) {
        try {
          // 构建选题建议 prompt
          const itemTexts = digestModel.bookmarkItems
            .slice(0, 10)
            .map((item) => `${item.title}: ${item.snippet ?? ""}`);
          const prompt = buildTopicSuggestionPrompt(itemTexts);

          // 调用 AI 生成选题建议
          const suggestions = await aiClient.suggestTopics(prompt);

          // 解析来源链接并添加到视图模型
          digestModel.topicSuggestions = resolveTopicSuggestions(suggestions, digestModel.bookmarkItems);
        } catch (error) {
          // AI 调用失败时不影响主流程，仅打印警告
          console.error("Failed to generate topic suggestions:", error);
        }
      }
    }

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

  console.log(`information-aggregator ${getCliVersion()}\n`);
  console.log(getHelpText());
}

await main();
