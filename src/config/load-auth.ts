import type { AuthConfig } from "../types/index";
import { prisma } from "../../lib/prisma";

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
 * 从数据库 AuthConfig 表加载所有 auth 配置
 * @returns auth 配置映射（按 authKey 分组）
 */
export async function loadAuthConfigsFromDb(): Promise<Record<string, Record<string, unknown>>> {
  const configs = await prisma.authConfig.findMany({
    include: { source: { select: { type: true } } },
  });
  const result: Record<string, Record<string, unknown>> = {};

  for (const config of configs) {
    const authKey = getAuthKeyForSourceType(config.source.type);
    if (!authKey) continue;

    try {
      result[authKey] = JSON.parse(config.configJson);
    } catch {
      // 跳过无效 JSON
    }
  }

  return result;
}

/**
 * 根据 source type 推断 authKey
 */
function getAuthKeyForSourceType(sourceType: string): string | null {
  const mapping: Record<string, string> = {
    "x-bookmarks": "x-family",
    "x-home": "x-family",
    "x-likes": "x-family",
    "x-list": "x-family",
  };
  return mapping[sourceType] ?? null;
}
