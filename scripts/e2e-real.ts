import { runQuery } from "../src/query/run-query";
import type { QueryViewDefinition, SourcePack, TopicDefinition, TopicProfile } from "../src/types/index";
import { getRealProbeSources, probeLooksHealthy } from "../src/verification/real-probe";
import { buildViewModel, renderViewMarkdown } from "../src/views/registry";

const sources = getRealProbeSources();
const profiles: TopicProfile[] = [
  {
    id: "default",
    name: "Real Probe",
    topicIds: ["real-probe"],
    sourcePackIds: ["real-probe-pack"],
    defaultView: "daily-brief",
    defaultWindow: "24h",
  },
];
const topics: TopicDefinition[] = [
  {
    id: "real-probe",
    name: "Real Probe",
    keywords: ["ai", "news", "model"],
  },
];
const sourcePacks: SourcePack[] = [
  {
    id: "real-probe-pack",
    name: "Real Probe Pack",
    sourceIds: sources.map((source) => source.id),
  },
];
const views: QueryViewDefinition[] = [
  { id: "item-list", name: "Item List", defaultWindow: "7d", defaultSort: "recent" },
  { id: "daily-brief", name: "Daily Brief", defaultWindow: "24h", defaultSort: "ranked" },
];

console.log("Running real-source item-list probe...");
const scanResult = await runQuery({
  command: "run",
  profileId: "default",
  viewId: "item-list",
  format: "markdown",
}, {
  loadSources: () => sources,
  loadProfiles: () => profiles,
  loadTopics: () => topics,
  loadSourcePacks: () => sourcePacks,
  loadViews: () => views,
});
const scanMarkdown = renderViewMarkdown(await buildViewModel(scanResult, "item-list"), "item-list");

if (!probeLooksHealthy(scanMarkdown)) {
  console.error("Real item-list probe failed to produce healthy markdown output.");
  process.exit(1);
}

console.log("Running real-source daily-brief probe...");
const digestResult = await runQuery({
  command: "run",
  profileId: "default",
  viewId: "daily-brief",
  format: "markdown",
}, {
  loadSources: () => sources,
  loadProfiles: () => profiles,
  loadTopics: () => topics,
  loadSourcePacks: () => sourcePacks,
  loadViews: () => views,
});
const digestMarkdown = renderViewMarkdown(await buildViewModel(digestResult, "daily-brief"), "daily-brief");

if (!probeLooksHealthy(digestMarkdown)) {
  console.error("Real daily-brief probe failed to produce healthy markdown output.");
  process.exit(1);
}

console.log("Real-source probe passed.");
