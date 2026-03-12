import { runQuery } from "../query/run-query";
import { loadAllPacks } from "../config/load-pack";
import { buildViewModel, renderViewMarkdown } from "../views/registry";

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
});
const dailyMarkdown = renderViewMarkdown(await buildViewModel(dailyResult, "daily-brief"), "daily-brief");

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
});
const xMarkdown = renderViewMarkdown(await buildViewModel(xResult, "x-analysis"), "x-analysis");

if (!probeLooksHealthy(xMarkdown)) {
  console.error("X-analysis probe failed.");
  process.exit(1);
}
console.log("X-analysis probe passed.");

console.log("All e2e probes passed.");
