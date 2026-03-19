import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import YAML from "yaml"
import type { SchedulerConfig } from "./reports-schema"

export async function loadSchedulerConfig(): Promise<SchedulerConfig> {
  const path = resolve(process.cwd(), "config/scheduler.yaml")
  const content = await readFile(path, "utf8")
  const parsed = YAML.parse(content) as { scheduler: SchedulerConfig }
  return parsed.scheduler
}
