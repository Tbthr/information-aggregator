import { runQuery } from "../src/query/run-query";
import type { SourcePack } from "../src/types/index";
import { getRealProbeSources, probeLooksHealthy } from "../src/verification/real-probe";
import { buildViewModel, renderViewMarkdown } from "../src/views/registry";

const sources = getRealProbeSources();
const sourcePacks: SourcePack[] = [
  {
    id: "real-probe-pack",
    name: "Real Probe Pack",
    sources: sources,
  },
];

console.log("Running real-source daily-brief probe...");
const scanResult = await runQuery({
  packIds: ["real-probe-pack"],
  viewId: "daily-brief",
  window: "7d",
}, {
  loadPacks: async () => sourcePacks,
});
const scanMarkdown = renderViewMarkdown(await buildViewModel(scanResult, "daily-brief"), "daily-brief");

if (!probeLooksHealthy(scanMarkdown)) {
  console.error("Real daily-brief probe failed to produce healthy markdown output.");
  process.exit(1);
}

console.log("Running real-source daily-brief probe...");
const digestResult = await runQuery({
  packIds: ["real-probe-pack"],
  viewId: "daily-brief",
  window: "24h",
}, {
  loadPacks: async () => sourcePacks,
});
const digestMarkdown = renderViewMarkdown(await buildViewModel(digestResult, "daily-brief"), "daily-brief");

if (!probeLooksHealthy(digestMarkdown)) {
  console.error("Real daily-brief probe failed to produce healthy markdown output.");
  process.exit(1);
}

console.log("Real-source probe passed.");
