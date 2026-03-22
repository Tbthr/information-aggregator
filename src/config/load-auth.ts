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
 * 从环境变量加载 auth 配置（同步）
 * @returns auth 配置映射（按 authKey 分组）
 */
export function loadAuthConfigsFromEnv(): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};

  const authToken = process.env.X_AUTH_TOKEN?.trim();
  const ct0 = process.env.X_CT0?.trim();

  if (authToken && ct0) {
    result["x-family"] = { authToken, ct0 };
  }

  return result;
}

// 模块级缓存
let cachedAuthConfigs: Record<string, Record<string, unknown>> | null = null;

/**
 * 获取 auth 配置（带缓存）
 */
export function getAuthConfigs(): Record<string, Record<string, unknown>> {
  if (!cachedAuthConfigs) {
    cachedAuthConfigs = loadAuthConfigsFromEnv();
  }
  return cachedAuthConfigs;
}

/**
 * 清除 auth 配置缓存（测试用）
 */
export function clearAuthConfigCache(): void {
  cachedAuthConfigs = null;
}
