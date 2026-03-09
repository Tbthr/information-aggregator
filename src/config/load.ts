import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";

import type { Source } from "../types/index";
import { validateSource } from "./validate";

export async function loadSourcesConfig(filePath: string): Promise<Source[]> {
  const absolutePath = resolve(process.cwd(), filePath);
  const fileContents = await readFile(absolutePath, "utf8");
  const parsed = YAML.parse(fileContents) as { sources?: unknown[] } | null;

  if (!parsed || !Array.isArray(parsed.sources)) {
    throw new Error("Invalid sources config: sources must be an array");
  }

  return parsed.sources.map((source) => validateSource(source));
}
