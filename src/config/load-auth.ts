import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import type { AuthConfig, SourceType } from "../types/index";

const ADAPTER_AUTH_MAP: Record<string, string> = {
  x_home: "x-family",
  x_list: "x-family",
  x_bookmarks: "x-family",
  x_likes: "x-family",
  reddit: "reddit",
};

export function getAuthFileForSourceType(sourceType: SourceType): string | undefined {
  return ADAPTER_AUTH_MAP[sourceType];
}

export function validateAuthConfig(input: unknown): AuthConfig {
  if (typeof input !== "object" || input === null) {
    throw new Error("AuthConfig must be an object");
  }
  const record = input as Record<string, unknown>;

  if (typeof record.adapter !== "string" || !record.adapter) {
    throw new Error("AuthConfig.adapter is required");
  }
  if (typeof record.config !== "object" || record.config === null) {
    throw new Error("AuthConfig.config is required");
  }

  return {
    adapter: record.adapter,
    config: record.config as Record<string, unknown>,
  };
}

async function loadYamlFile(filePath: string): Promise<Record<string, unknown>> {
  const absolutePath = resolve(process.cwd(), filePath);
  const fileContents = await readFile(absolutePath, "utf8");
  return (YAML.parse(fileContents) as Record<string, unknown> | null) ?? {};
}

export async function loadAuthConfig(filePath: string): Promise<AuthConfig> {
  const parsed = await loadYamlFile(filePath);
  return validateAuthConfig(parsed);
}
