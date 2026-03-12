import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runQuery } from "../query/run-query";
import { loadAllPacks } from "../config/load-pack";
import { buildViewModel, renderViewMarkdown } from "../views/registry";
import { createAnthropicClient, createGeminiClient } from "../ai/providers";
import type { AiClient } from "../ai/types";

// 确保 out 目录存在
const outDir = resolve(process.cwd(), "out");
mkdirSync(outDir, { recursive: true });

/**
 * 创建 AI client（优先 Anthropic，回退 Gemini）
 */
function createAiClientForE2e(): AiClient | null {
  // 优先尝试 Anthropic
  const anthropic = createAnthropicClient();
  if (anthropic) {
    console.log("Using Anthropic AI client");
    return anthropic;
  }

  // 回退到 Gemini
  const gemini = createGeminiClient();
  if (gemini) {
    console.log("Using Gemini AI client");
    return gemini;
  }

  console.log("No AI client configured (set ANTHROPIC_AUTH_TOKEN or GEMINI_API_KEY)");
  return null;
}

const aiClient = createAiClientForE2e();

/**
 * 检查 markdown 输出是否包含链接
 */
function probeLooksHealthy(markdown: string): boolean {
  return markdown.includes("](") || markdown.includes("http");
}

// 测试 daily-brief view
console.log("Running daily-brief probe with test_daily pack...");
const dailyResult = await runQuery({
  packIds: ["test_daily"],
  viewId: "daily-brief",
  window: "24h",
}, {
  loadPacks: () => loadAllPacks("config/packs"),
  aiClient,
});
const dailyMarkdown = renderViewMarkdown(
  await buildViewModel(dailyResult, "daily-brief", { aiClient }),
  "daily-brief"
);

// 写入到 out 目录
writeFileSync(resolve(outDir, "e2e-daily-brief.md"), dailyMarkdown);
console.log("Written: out/e2e-daily-brief.md");

if (!probeLooksHealthy(dailyMarkdown)) {
  console.error("Daily-brief probe failed.");
  process.exit(1);
}
console.log("Daily-brief probe passed.");

// 测试 x-analysis view
console.log("Running x-analysis probe with test_x_analysis pack...");
const xResult = await runQuery({
  packIds: ["test_x_analysis"],
  viewId: "x-analysis",
  window: "all",
}, {
  loadPacks: () => loadAllPacks("config/packs"),
  aiClient,
});
const xMarkdown = renderViewMarkdown(
  await buildViewModel(xResult, "x-analysis", { aiClient }),
  "x-analysis"
);

// 写入到 out 目录
writeFileSync(resolve(outDir, "e2e-x-analysis.md"), xMarkdown);
console.log("Written: out/e2e-x-analysis.md");

if (!probeLooksHealthy(xMarkdown)) {
  console.error("X-analysis probe failed.");
  process.exit(1);
}
console.log("X-analysis probe passed.");

console.log("All e2e probes passed.");
