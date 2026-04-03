import type { AdapterFn, Source } from "../types/index";

/**
 * 项目级适配器家族定义
 */
export const ADAPTER_FAMILIES: AdapterFamily[] = [];

/**
 * 适配器家族定义
 * 用于批量注册共享相同 collect 函数和 auth 配置的适配器
 */
export interface AdapterFamily {
  /** 适配器名称列表 */
  names: readonly string[];
  /** collect 函数 */
  collect: AdapterFn;
  /** auth 配置的 key（可选） */
  authKey?: string;
}

/**
 * 已注册的适配器家族内部结构
 */
interface RegisteredFamily {
  collect: AdapterFn;
  authKey?: string;
  getAuth?: () => Record<string, unknown> | undefined;
}

// 存储已注册的适配器家族
const registeredFamilies = new Map<string, RegisteredFamily>();

/**
 * 注册一个适配器家族
 * @param family 适配器家族定义
 * @param getAuth 获取 auth 配置的函数（可选）
 * @returns 返回一个对象，key 为适配器名称，value 为 collector 函数
 */
export function registerAdapterFamily(
  family: AdapterFamily,
  getAuth?: () => Record<string, unknown> | undefined,
): Record<string, AdapterFn> {
  // 创建 collector
  const collector: AdapterFn = (source: Source, options) => {
    return family.collect(source, options);
  };

  // 存储到注册表（用于后续查找）
  for (const name of family.names) {
    registeredFamilies.set(name, {
      collect: family.collect,
      authKey: family.authKey,
      getAuth,
    });
  }

  // 返回名称到 collector 的映射
  return Object.fromEntries(family.names.map((name) => [name, collector]));
}

/**
 * 批量注册多个适配器家族
 * @param families 适配器家族定义数组
 * @param authConfigs auth 配置映射（按 authKey 分组）
 * @returns 合并后的适配器映射
 */
export function registerAdapterFamilies(
  families: AdapterFamily[],
  authConfigs: Record<string, Record<string, unknown>> = {},
): Record<string, AdapterFn> {
  const result: Record<string, AdapterFn> = {};

  for (const family of families) {
    const key = family.authKey;
    const getAuth = key ? () => authConfigs[key] : undefined;
    const collectors = registerAdapterFamily(family, getAuth);
    Object.assign(result, collectors);
  }

  return result;
}

/**
 * 获取已注册的适配器家族信息
 * @param name 适配器名称
 * @returns 适配器家族信息或 undefined
 */
export function getAdapterFamily(name: string): RegisteredFamily | undefined {
  return registeredFamilies.get(name);
}

/**
 * 检查适配器是否已注册
 * @param name 适配器名称
 */
export function hasAdapter(name: string): boolean {
  return registeredFamilies.has(name);
}
