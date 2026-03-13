import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runQuery } from "../query/run-query";
import { loadAllPacks } from "../config/load-pack";
import { buildViewModel, renderViewMarkdown } from "../views/registry";
import { createAiClient } from "../ai/providers";
import type { AiClient } from "../ai/types";
import { createLogger } from "../utils/logger";

const logger = createLogger("e2e");

// 确保 out 目录存在
const outDir = resolve(process.cwd(), "out");
mkdirSync(outDir, { recursive: true });

/**
 * 创建 AI client（优先 Anthropic，回退 Gemini）
 */
async function createAiClientForE2e(): Promise<AiClient | null> {
  // 优先尝试 Anthropic
  const anthropic = await createAiClient("anthropic");
  if (anthropic) {
    logger.info("Using Anthropic AI client");
    return anthropic;
  }

  // 回退到 Gemini
  const gemini = await createAiClient("gemini");
  if (gemini) {
    logger.info("Using Gemini AI client");
    return gemini;
  }

  logger.warn("No AI client configured (set ANTHROPIC_AUTH_TOKEN or GEMINI_API_KEY)");
  return null;
}

const aiClient = await createAiClientForE2e();

/**
 * 检查 markdown 输出是否包含链接
 */
function probeLooksHealthy(markdown: string): boolean {
  return markdown.includes("](") || markdown.includes("http");
}

// 测试 daily-brief view
logger.info("Running daily-brief probe", { packIds: ["test_daily"], viewId: "daily-brief", window: "24h" });
const dailyStartTime = Date.now();

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
logger.info("Written output file", { path: "out/e2e-daily-brief.md", size: dailyMarkdown.length });

if (!probeLooksHealthy(dailyMarkdown)) {
  logger.error("Daily-brief probe failed", { reason: "No links found in output" });
  process.exit(1);
}
logger.info("Daily-brief probe passed", { elapsed: Date.now() - dailyStartTime });

// 测试 x-analysis view
logger.info("Running x-analysis probe", { packIds: ["test_x_analysis"], viewId: "x-analysis", window: "all" });
const xStartTime = Date.now();

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
logger.info("Written output file", { path: "out/e2e-x-analysis.md", size: xMarkdown.length });

if (!probeLooksHealthy(xMarkdown)) {
  logger.error("X-analysis probe failed", { reason: "No links found in output" });
  process.exit(1);
}
logger.info("X-analysis probe passed", { elapsed: Date.now() - xStartTime });

logger.info("All e2e probes passed");
