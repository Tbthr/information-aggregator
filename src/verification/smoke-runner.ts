import { spawnSync } from "node:child_process";

import { getSmokeCommands } from "./smoke";

for (const command of getSmokeCommands()) {
  console.log(`$ ${command}`);
  const result = spawnSync(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Smoke verification passed.");
