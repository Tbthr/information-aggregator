import { runDigest } from "../src/cli/run-digest";
import { runScan } from "../src/cli/run-scan";
import type { SourcePack, TopicDefinition, TopicProfile } from "../src/types/index";
import { getRealProbeSources, probeLooksHealthy } from "../src/verification/real-probe";

const sources = getRealProbeSources();
const profiles: TopicProfile[] = [
  {
    id: "default",
    name: "Real Probe",
    mode: "digest",
    topicIds: ["real-probe"],
    sourcePackIds: ["real-probe-pack"],
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

console.log("Running real-source scan probe...");
const scanResult = await runScan({
  profileId: "default",
  dryRun: true,
}, {
  loadSources: () => sources,
  loadProfiles: () => profiles,
  loadTopics: () => topics,
  loadSourcePacks: () => sourcePacks,
});

if (!probeLooksHealthy(scanResult.markdown)) {
  console.error("Real scan probe failed to produce healthy markdown output.");
  process.exit(1);
}

console.log("Running real-source digest probe...");
const digestResult = await runDigest({
  profileId: "default",
  dryRun: true,
}, {
  loadSources: () => sources,
  loadProfiles: () => profiles,
  loadTopics: () => topics,
  loadSourcePacks: () => sourcePacks,
});

if (!probeLooksHealthy(digestResult.markdown)) {
  console.error("Real digest probe failed to produce healthy markdown output.");
  process.exit(1);
}

console.log("Real-source probe passed.");
