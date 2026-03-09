import { runDigest } from "../src/cli/run-digest";
import { runScan } from "../src/cli/run-scan";
import { getRealProbeSources, probeLooksHealthy } from "../src/verification/real-probe";

const sources = getRealProbeSources();

console.log("Running real-source scan probe...");
const scanResult = await runScan({
  profileId: "default",
  dryRun: true,
}, {
  listSources: () => sources,
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
  listSources: () => sources,
});

if (!probeLooksHealthy(digestResult.markdown)) {
  console.error("Real digest probe failed to produce healthy markdown output.");
  process.exit(1);
}

console.log("Real-source probe passed.");
