import { readFile, readdir } from "node:fs/promises";
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
 * 将 source 配置与 auth 配置合并
 * @param source 原始 source
 * @param authConfig auth 配置对象
 * @returns 合并后的 source
 */
export function mergeAuthConfig<T extends { configJson?: string }>(
  source: T,
  authConfig: Record<string, unknown>,
): T & { configJson: string } {
  const sourceConfig = JSON.parse(source.configJson || "{}");
  const merged = { ...sourceConfig, ...authConfig };
  return { ...source, configJson: JSON.stringify(merged) };
}

/**
 * 同步加载所有 auth 配置（用于 CLI 命令）
 * 注意：这是简化的同步版本，假设配置文件已经存在
 * @param authDir auth 配置目录路径
 * @returns auth 配置映射（按 authKey 分组）
 */
export function loadAllAuthConfigs(authDir: string = "config/auth"): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};

  // 尝试同步读取目录
  try {
    const files = require("fs").readdirSync(resolve(process.cwd(), authDir));
    for (const file of files) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        const authKey = file.replace(/\.(yaml|yml)$/, "");
        const filePath = resolve(authDir, file);
        try {
          const content = require("fs").readFileSync(filePath, "utf8");
          const parsed = YAML.parse(content) as Record<string, unknown> | null;
          if (parsed?.config) {
            result[authKey] = parsed.config as Record<string, unknown>;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  } catch {
    // 目录不存在或无法读取，返回空对象
  }

  return result;
}
