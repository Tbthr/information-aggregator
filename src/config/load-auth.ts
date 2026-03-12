import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import type { AuthConfig } from "../types/index";

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

/**
 * 加载指定 auth 配置文件
 * @param authRef auth 引用名称（不含 .yaml 后缀）
 * @param authDir auth 配置目录路径，如 "config/auth"
 * @returns auth 配置对象
 */
export async function loadAuthByRef(
  authRef: string,
  authDir: string = "config/auth"
): Promise<Record<string, unknown>> {
  const filePath = resolve(authDir, `${authRef}.yaml`);
  const config = await loadAuthConfig(filePath);
  return config.config;
}

/**
 * 加载指定目录下所有 auth 配置文件
 * @param authDir auth 配置目录路径，如 "config/auth"
 * @returns 按 adapter 名称分组的配置映射
 */
export async function loadAllAuthConfigs(authDir: string): Promise<Record<string, Record<string, unknown>>> {
  const authConfigs: Record<string, Record<string, unknown>> = {};

  // 定义需要加载的 auth 配置文件
  const authFiles = ["x-family.yaml", "reddit.yaml"];

  for (const filename of authFiles) {
    const filePath = resolve(authDir, filename);
    try {
      const config = await loadAuthConfig(filePath);
      const adapterName = filename.replace(".yaml", "");
      authConfigs[adapterName] = config.config;
    } catch (error) {
      // 如果文件不存在或加载失败，继续处理其他文件
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return authConfigs;
}

/**
 * 将 source 配置与 auth 配置合并
 * @param source 原始 source
 * @param authConfig auth 配置对象
 * @returns 合并后的 source
 */
export function mergeAuthConfig(source: { configJson?: string }, authConfig: Record<string, unknown>): { configJson: string } {
  const sourceConfig = JSON.parse(source.configJson || "{}");
  const merged = { ...sourceConfig, ...authConfig };
  return { ...source, configJson: JSON.stringify(merged) };
}
